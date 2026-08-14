using System.Collections.Concurrent;
using System.Diagnostics;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Services;

public interface IErrorLoggingService
{
    Task LogErrorAsync(
        string category, 
        string message, 
        Exception? ex = null, 
        Guid? sessionId = null, 
        string? sessionCode = null, 
        string severity = "Error", 
        string? contextData = null);

    Task<SystemDiagnosticsSummaryDto> GetDiagnosticsAsync(Guid? sessionId = null, CancellationToken ct = default);
    Task<List<SystemErrorLogDto>> GetLogsAsync(Guid? sessionId = null, int limit = 100, CancellationToken ct = default);
}

public class ErrorLoggingService : IErrorLoggingService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ErrorLoggingService> _logger;
    private static readonly ConcurrentQueue<SystemErrorLogDto> _inMemoryBuffer = new();
    private static readonly DateTime _serverStartTime = DateTime.UtcNow;
    private const int MaxBufferCount = 200;

    public ErrorLoggingService(IServiceScopeFactory scopeFactory, ILogger<ErrorLoggingService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task LogErrorAsync(
        string category, 
        string message, 
        Exception? ex = null, 
        Guid? sessionId = null, 
        string? sessionCode = null, 
        string severity = "Error", 
        string? contextData = null)
    {
        var nowUtc = DateTime.UtcNow;
        var nowIst = nowUtc.AddHours(5).AddMinutes(30);

        var logEntity = new SystemErrorLog
        {
            SessionId = sessionId,
            SessionCode = sessionCode,
            Category = category,
            Severity = severity,
            ErrorMessage = message + (ex != null ? $" | Exception: {ex.Message}" : ""),
            StackTrace = ex?.StackTrace,
            ContextData = contextData,
            TimestampUtc = nowUtc,
            TimestampIst = nowIst
        };

        var logDto = new SystemErrorLogDto
        {
            Id = logEntity.Id,
            SessionId = sessionId,
            SessionCode = sessionCode,
            Category = category,
            Severity = severity,
            ErrorMessage = logEntity.ErrorMessage,
            StackTrace = logEntity.StackTrace,
            ContextData = contextData,
            TimestampUtc = nowUtc,
            TimestampIst = nowIst
        };

        // Add to in-memory circular buffer for instant real-time diagnostic retrieval
        _inMemoryBuffer.Enqueue(logDto);
        while (_inMemoryBuffer.Count > MaxBufferCount)
        {
            _inMemoryBuffer.TryDequeue(out _);
        }

        // Log to ASP.NET Core Logger
        if (severity == "Critical" || severity == "Error")
        {
            _logger.LogError(ex, "[{Category}] {Message} (Context: {Context})", category, message, contextData);
        }
        else
        {
            _logger.LogWarning("[{Category}] {Message} (Context: {Context})", category, message, contextData);
        }

        // Asynchronously persist to database in background
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
                await repo.LogSystemErrorAsync(logEntity);
            }
            catch (Exception persistEx)
            {
                _logger.LogWarning("Failed to persist SystemErrorLog to DB: {Message}", persistEx.Message);
            }
        });
    }

    public async Task<SystemDiagnosticsSummaryDto> GetDiagnosticsAsync(Guid? sessionId = null, CancellationToken ct = default)
    {
        var logs = await GetLogsAsync(sessionId, 50, ct);
        var proc = Process.GetCurrentProcess();
        var memoryMb = Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 2);

        return new SystemDiagnosticsSummaryDto
        {
            TotalErrorsLogged = logs.Count,
            TotalCriticalCount = logs.Count(l => l.Severity == "Critical"),
            TotalWarningCount = logs.Count(l => l.Severity == "Warning"),
            ServerUptimeUtc = _serverStartTime,
            ServerMemoryMb = memoryMb,
            ActiveConnections = _inMemoryBuffer.Count,
            RecentLogs = logs
        };
    }

    public async Task<List<SystemErrorLogDto>> GetLogsAsync(Guid? sessionId = null, int limit = 100, CancellationToken ct = default)
    {
        // Try DB first
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
            var dbLogs = await repo.GetSystemLogsAsync(sessionId, limit, ct);

            if (dbLogs.Count > 0)
            {
                return dbLogs.Select(l => new SystemErrorLogDto
                {
                    Id = l.Id,
                    SessionId = l.SessionId,
                    SessionCode = l.SessionCode,
                    Category = l.Category,
                    Severity = l.Severity,
                    ErrorMessage = l.ErrorMessage,
                    StackTrace = l.StackTrace,
                    ContextData = l.ContextData,
                    TimestampUtc = l.TimestampUtc,
                    TimestampIst = l.TimestampIst
                }).ToList();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to query system logs from DB, falling back to in-memory buffer: {Message}", ex.Message);
        }

        // Fallback to in-memory buffer
        var inMem = _inMemoryBuffer.ToList();
        if (sessionId.HasValue && sessionId.Value != Guid.Empty)
        {
            inMem = inMem.Where(l => l.SessionId == sessionId.Value).ToList();
        }

        return inMem
            .OrderByDescending(l => l.TimestampUtc)
            .Take(limit)
            .ToList();
    }
}

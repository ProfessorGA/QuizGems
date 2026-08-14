using System.Collections.Concurrent;
using System.Threading.Channels;
using QuizMaster.Core.Entities;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Services;

public interface IAnswerQueueService
{
    ValueTask EnqueueAnswerAsync(QuizAnswer answer, CancellationToken ct = default);
    Task FlushAsync(Guid sessionId, CancellationToken ct = default);
    int PendingCount { get; }
}

public class BackgroundAnswerQueueService : BackgroundService, IAnswerQueueService
{
    private readonly Channel<QuizAnswer> _channel;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BackgroundAnswerQueueService> _logger;
    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _sessionFlushLocks = new();

    public BackgroundAnswerQueueService(IServiceScopeFactory scopeFactory, ILogger<BackgroundAnswerQueueService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        // Unbounded channel for ultra-high throughput without blocking HTTP/SignalR threads
        _channel = Channel.CreateUnbounded<QuizAnswer>(new UnboundedChannelOptions
        {
            SingleWriter = false,
            SingleReader = true
        });
    }

    public int PendingCount => _channel.Reader.Count;

    public ValueTask EnqueueAnswerAsync(QuizAnswer answer, CancellationToken ct = default)
    {
        if (_channel.Writer.TryWrite(answer))
        {
            return ValueTask.CompletedTask;
        }
        return _channel.Writer.WriteAsync(answer, ct);
    }

    public async Task FlushAsync(Guid sessionId, CancellationToken ct = default)
    {
        // Drain any pending items immediately
        var drained = new List<QuizAnswer>();
        while (_channel.Reader.TryRead(out var item))
        {
            drained.Add(item);
        }

        if (drained.Count > 0)
        {
            await PersistBatchAsync(drained, ct);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BackgroundAnswerQueueService started. Decoupling real-time voting from PostgreSQL write latency.");

        var buffer = new List<QuizAnswer>();
        var batchTimeout = TimeSpan.FromMilliseconds(150);
        var maxBatchSize = 50;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Wait for at least one item
                if (await _channel.Reader.WaitToReadAsync(stoppingToken))
                {
                    var startBatchTime = DateTime.UtcNow;

                    while (buffer.Count < maxBatchSize && (DateTime.UtcNow - startBatchTime) < batchTimeout)
                    {
                        if (_channel.Reader.TryRead(out var answer))
                        {
                            buffer.Add(answer);
                        }
                        else
                        {
                            // Yield briefly to gather incoming burst
                            await Task.Delay(20, stoppingToken);
                            if (!_channel.Reader.TryRead(out var nextAnswer))
                            {
                                break;
                            }
                            buffer.Add(nextAnswer);
                        }
                    }

                    if (buffer.Count > 0)
                    {
                        await PersistBatchAsync(buffer, stoppingToken);
                        buffer.Clear();
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in BackgroundAnswerQueueService: {Message}", ex.Message);
                await Task.Delay(250, stoppingToken);
            }
        }

        // Flush remaining on shutdown
        var finalFlush = new List<QuizAnswer>();
        while (_channel.Reader.TryRead(out var remaining))
        {
            finalFlush.Add(remaining);
        }
        if (finalFlush.Count > 0)
        {
            await PersistBatchAsync(finalFlush, CancellationToken.None);
        }
    }

    private async Task PersistBatchAsync(List<QuizAnswer> answers, CancellationToken ct)
    {
        if (answers == null || answers.Count == 0) return;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

            await repo.SaveAnswersBatchAsync(answers, ct);
            _logger.LogDebug("Persisted batch of {Count} quiz answers to database.", answers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error persisting batch of {Count} answers to PostgreSQL: {Message}", answers.Count, ex.Message);

            // Log to system error logs
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
                await repo.LogSystemErrorAsync(new SystemErrorLog
                {
                    Category = "Database",
                    Severity = "Error",
                    ErrorMessage = $"Batch answer persistence failed for {answers.Count} items: {ex.Message}",
                    StackTrace = ex.StackTrace,
                    ContextData = $"Answers count: {answers.Count}, First Session: {answers[0].SessionId}"
                }, ct);
            }
            catch {}
        }
    }
}

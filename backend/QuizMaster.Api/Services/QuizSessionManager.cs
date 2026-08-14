using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using QuizMaster.Api.Hubs;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Core.Enums;
using QuizMaster.Core.Hubs;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Services;

public class ActiveSessionCacheItem
{
    public Guid SessionId { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public int CurrentQuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public Guid ActiveQuestionId { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? VotingEndsAt { get; set; }
    public int DurationSeconds { get; set; }
    public int TotalParticipants { get; set; }

    // Map: ParticipantId -> FullName
    public ConcurrentDictionary<Guid, string> EnrolledParticipants { get; set; } = new();

    // Map: ParticipantId -> (SelectedOption, ResponseMs, ServerReceivedAt)
    public ConcurrentDictionary<Guid, (int SelectedOption, double ResponseMs, DateTime ServerReceivedAt)> Submissions { get; set; } = new();
}

public interface IQuizSessionManager
{
    Task<QuizSession> StartSessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<VotingStartedHubDto> StartVotingAsync(Guid sessionId, CancellationToken ct = default);
    Task<VotingEndedHubDto> EndVotingAsync(Guid sessionId, CancellationToken ct = default);
    Task<QuestionResultHubDto> SetCorrectAnswerAsync(Guid sessionId, int correctOption, CancellationToken ct = default);
    Task<NextQuestionHubDto?> NextQuestionAsync(Guid sessionId, CancellationToken ct = default);
    Task<FinalScoreboardDto> CompleteQuizAsync(Guid sessionId, CancellationToken ct = default);
    Task<QuestionCancelledHubDto> CancelQuestionAsync(Guid sessionId, int questionNumber, string? reason = null, CancellationToken ct = default);
    Task<SubmitAnswerResponse> SubmitAnswerAsync(string sessionCode, Guid participantId, int selectedOption, CancellationToken ct = default);
    Task<ParticipantStateDto> RenameParticipantAsync(string sessionCode, Guid participantId, string newFullName, CancellationToken ct = default);
    Task<ParticipantStateDto> GetParticipantStateAsync(string sessionCode, Guid participantId, CancellationToken ct = default);
    Task<SessionDetailDto> GetSessionDetailAsync(Guid sessionId, CancellationToken ct = default);
}

public class QuizSessionManager : IQuizSessionManager
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<QuizHub, IQuizHubClient> _hubContext;
    private readonly IAnswerQueueService _answerQueue;
    private readonly IErrorLoggingService _errorLogger;

    private static readonly ConcurrentDictionary<Guid, CancellationTokenSource> _activeTimers = new();
    private static readonly ConcurrentDictionary<string, ActiveSessionCacheItem> _sessionCaches = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _cacheInitLocks = new(StringComparer.OrdinalIgnoreCase);

    public QuizSessionManager(
        IServiceScopeFactory scopeFactory,
        IHubContext<QuizHub, IQuizHubClient> hubContext,
        IAnswerQueueService answerQueue,
        IErrorLoggingService errorLogger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _answerQueue = answerQueue;
        _errorLogger = errorLogger;
    }

    private async Task<ActiveSessionCacheItem> GetOrRefreshCacheAsync(string sessionCode, CancellationToken ct = default)
    {
        var normalizedCode = sessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cached))
        {
            return cached;
        }

        var gate = _cacheInitLocks.GetOrAdd(normalizedCode, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (_sessionCaches.TryGetValue(normalizedCode, out cached))
            {
                return cached;
            }

            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

            var session = await repo.GetSessionByCodeAsync(normalizedCode, ct);
            if (session == null)
            {
                throw new KeyNotFoundException($"Session '{sessionCode}' not found.");
            }

            var currentQNum = Math.Max(1, session.CurrentQuestionNumber);
            var question = await repo.GetQuestionByNumberAsync(session.Id, currentQNum, ct);
            var participants = await repo.GetParticipantsBySessionIdAsync(session.Id, ct);

            var cacheItem = new ActiveSessionCacheItem
            {
                SessionId = session.Id,
                SessionCode = session.SessionCode,
                Status = session.Status,
                CurrentQuestionNumber = currentQNum,
                TotalQuestions = session.TotalQuestions,
                ActiveQuestionId = question?.Id ?? Guid.Empty,
                StartedAt = question?.StartedAt,
                VotingEndsAt = question?.VotingEndsAt,
                DurationSeconds = session.QuestionDurationSeconds > 0 ? session.QuestionDurationSeconds : 15,
                TotalParticipants = participants.Count
            };

            foreach (var p in participants)
            {
                cacheItem.EnrolledParticipants[p.Id] = p.FullName;
            }

            // Load any already recorded answers
            if (question != null)
            {
                var existingAnswers = await repo.GetAnswersForQuestionAsync(question.Id, ct);
                foreach (var a in existingAnswers)
                {
                    cacheItem.Submissions[a.ParticipantId] = (a.SelectedOption, a.ResponseMilliseconds, a.ServerReceivedAt);
                }
            }

            _sessionCaches[normalizedCode] = cacheItem;
            return cacheItem;
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<QuizSession> StartSessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        if (session.Status != SessionStatus.Created && session.Status != SessionStatus.Waiting)
        {
            throw new InvalidOperationException($"Cannot start session in status {session.Status}");
        }

        session.Status = SessionStatus.Waiting;
        session.StartedAt ??= DateTime.UtcNow;
        session.CurrentQuestionNumber = 1;

        // Ensure Question 1 exists
        var q1 = await repo.GetQuestionByNumberAsync(session.Id, 1, ct);
        if (q1 == null)
        {
            await repo.CreateQuestionAsync(new QuizQuestion
            {
                SessionId = session.Id,
                QuestionNumber = 1,
                Status = QuestionStatus.Pending
            }, ct);
        }

        await repo.UpdateSessionAsync(session, ct);

        // Update in-memory cache
        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        _sessionCaches.TryRemove(normalizedCode, out _);
        await GetOrRefreshCacheAsync(normalizedCode, ct);

        // Notify participants and admin
        var sessionState = new SessionStateHubDto
        {
            SessionId = session.Id,
            SessionCode = session.SessionCode,
            SessionName = session.SessionName,
            Status = session.Status,
            CurrentQuestionNumber = session.CurrentQuestionNumber,
            TotalQuestions = session.TotalQuestions,
            QuestionDurationSeconds = session.QuestionDurationSeconds,
            ParticipantCount = session.Participants.Count
        };

        await _hubContext.Clients.Group($"session_{session.SessionCode}").SessionStarted(sessionState);

        return session;
    }

    public async Task<VotingStartedHubDto> StartVotingAsync(Guid sessionId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        if (session.Status == SessionStatus.Voting)
        {
            throw new InvalidOperationException("Voting is already open for this session.");
        }

        if (session.Status == SessionStatus.Completed)
        {
            throw new InvalidOperationException("Session has already ended.");
        }

        var currentQNum = Math.Max(1, session.CurrentQuestionNumber);
        var question = await repo.GetQuestionByNumberAsync(session.Id, currentQNum, ct);
        if (question == null)
        {
            question = await repo.CreateQuestionAsync(new QuizQuestion
            {
                SessionId = session.Id,
                QuestionNumber = currentQNum,
                Status = QuestionStatus.Pending
            }, ct);
        }

        var nowUtc = DateTime.UtcNow;
        var duration = session.QuestionDurationSeconds > 0 ? session.QuestionDurationSeconds : 15;
        var endsAtUtc = nowUtc.AddSeconds(duration);

        question.StartedAt = nowUtc;
        question.VotingEndsAt = endsAtUtc;
        question.Status = QuestionStatus.Voting;
        await repo.UpdateQuestionAsync(question, ct);

        session.Status = SessionStatus.Voting;
        session.CurrentQuestionNumber = currentQNum;
        await repo.UpdateSessionAsync(session, ct);

        // Populate / Update High-Speed In-Memory Cache
        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        var participants = await repo.GetParticipantsBySessionIdAsync(session.Id, ct);

        var cacheItem = new ActiveSessionCacheItem
        {
            SessionId = session.Id,
            SessionCode = session.SessionCode,
            Status = SessionStatus.Voting,
            CurrentQuestionNumber = currentQNum,
            TotalQuestions = session.TotalQuestions,
            ActiveQuestionId = question.Id,
            StartedAt = nowUtc,
            VotingEndsAt = endsAtUtc,
            DurationSeconds = duration,
            TotalParticipants = participants.Count
        };

        foreach (var p in participants)
        {
            cacheItem.EnrolledParticipants[p.Id] = p.FullName;
        }

        _sessionCaches[normalizedCode] = cacheItem;

        var votingDto = new VotingStartedHubDto
        {
            QuestionId = question.Id,
            QuestionNumber = question.QuestionNumber,
            TotalQuestions = session.TotalQuestions,
            DurationSeconds = duration,
            VotingStartedAtUtc = nowUtc,
            VotingEndsAtUtc = endsAtUtc
        };

        // Cancel any existing timer for this session
        if (_activeTimers.TryRemove(sessionId, out var existingCts))
        {
            existingCts.Cancel();
            existingCts.Dispose();
        }

        // Create new cancellation source for automatic 15-second timeout
        var cts = new CancellationTokenSource();
        _activeTimers[sessionId] = cts;

        // Broadcast Voting Started to all participants and admin
        await _hubContext.Clients.Group($"session_{session.SessionCode}").VotingStarted(votingDto);

        // Authoritative Server Background Timer
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(duration), cts.Token);

                // Auto-close voting on server when timeout reaches
                await TriggerAutomaticTimeoutAsync(sessionId, question.Id, session.SessionCode, question.QuestionNumber);
            }
            catch (OperationCanceledException)
            {
                // Timer cancelled because voting was manually ended early or question advanced
            }
            catch (Exception ex)
            {
                await _errorLogger.LogErrorAsync("Voting", $"Error in automatic voting timer for session {sessionId}", ex, sessionId, session.SessionCode);
            }
            finally
            {
                _activeTimers.TryRemove(sessionId, out _);
            }
        });

        return votingDto;
    }

    private async Task TriggerAutomaticTimeoutAsync(Guid sessionId, Guid questionId, string sessionCode, int questionNumber)
    {
        var normalizedCode = sessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.Status = SessionStatus.VotingEnded;
        }

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var question = await repo.GetQuestionByNumberAsync(sessionId, questionNumber);
        if (question == null || question.Status != QuestionStatus.Voting) return;

        question.Status = QuestionStatus.VotingEnded;
        await repo.UpdateQuestionAsync(question);

        var session = await repo.GetSessionByIdAsync(sessionId);
        if (session != null && session.Status == SessionStatus.Voting)
        {
            session.Status = SessionStatus.VotingEnded;
            await repo.UpdateSessionAsync(session);
        }

        var totalAnswered = cache != null ? cache.Submissions.Count : (await repo.GetAnswersForQuestionAsync(questionId)).Count;
        var totalParticipants = cache != null ? Math.Max(cache.TotalParticipants, cache.EnrolledParticipants.Count) : (await repo.GetParticipantsBySessionIdAsync(sessionId)).Count;

        var summaryDto = new VotingEndedHubDto
        {
            QuestionNumber = questionNumber,
            TotalAnswered = totalAnswered,
            TotalParticipants = totalParticipants
        };

        await _hubContext.Clients.Group($"session_{sessionCode}").VotingEnded(summaryDto);
    }

    public async Task<VotingEndedHubDto> EndVotingAsync(Guid sessionId, CancellationToken ct = default)
    {
        // Cancel active server timer
        if (_activeTimers.TryRemove(sessionId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.Status = SessionStatus.VotingEnded;
        }

        var question = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        if (question != null)
        {
            question.Status = QuestionStatus.VotingEnded;
            await repo.UpdateQuestionAsync(question, ct);
        }

        session.Status = SessionStatus.VotingEnded;
        await repo.UpdateSessionAsync(session, ct);

        var totalAnswered = cache != null ? cache.Submissions.Count : (question != null ? (await repo.GetAnswersForQuestionAsync(question.Id, ct)).Count : 0);
        var totalParticipants = cache != null ? Math.Max(cache.TotalParticipants, cache.EnrolledParticipants.Count) : (await repo.GetParticipantsBySessionIdAsync(session.Id, ct)).Count;

        var summaryDto = new VotingEndedHubDto
        {
            QuestionNumber = session.CurrentQuestionNumber,
            TotalAnswered = totalAnswered,
            TotalParticipants = totalParticipants
        };

        await _hubContext.Clients.Group($"session_{session.SessionCode}").VotingEnded(summaryDto);

        return summaryDto;
    }

    public async Task<QuestionResultHubDto> SetCorrectAnswerAsync(Guid sessionId, int correctOption, CancellationToken ct = default)
    {
        if (correctOption < 1 || correctOption > 4)
        {
            throw new ArgumentOutOfRangeException(nameof(correctOption), "Option must be between 1 and 4.");
        }

        // Cancel timer if running
        if (_activeTimers.TryRemove(sessionId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }

        // CRITICAL: Flush any pending answers from the high-throughput background queue to DB before scoring!
        await _answerQueue.FlushAsync(sessionId, ct);

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
        var scoringService = scope.ServiceProvider.GetRequiredService<IQuizScoringService>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.Status = SessionStatus.AnswerReveal;
        }

        var question = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct)
            ?? throw new InvalidOperationException($"Question {session.CurrentQuestionNumber} not found.");

        question.CorrectOption = correctOption;
        question.Status = QuestionStatus.Scored;
        question.ScoredAt = DateTime.UtcNow;
        await repo.UpdateQuestionAsync(question, ct);

        session.Status = SessionStatus.AnswerReveal;
        await repo.UpdateSessionAsync(session, ct);

        // Score answers and calculate fastest bonus
        var resultDto = await scoringService.ScoreQuestionAsync(session, question, correctOption, ct);

        // Broadcast reveal
        await _hubContext.Clients.Group($"session_{session.SessionCode}").AnswerRevealed(new AnswerRevealedHubDto
        {
            QuestionNumber = question.QuestionNumber,
            CorrectOption = correctOption
        });

        // Broadcast detailed question results
        await _hubContext.Clients.Group($"session_{session.SessionCode}").QuestionResult(resultDto);

        // Broadcast updated leaderboard
        var leaderboard = await scoringService.GetLiveScoreboardAsync(session.Id, ct);
        await _hubContext.Clients.Group($"session_{session.SessionCode}").ScoreboardUpdated(leaderboard);

        return resultDto;
    }

    public async Task<NextQuestionHubDto?> NextQuestionAsync(Guid sessionId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
        var scoringService = scope.ServiceProvider.GetRequiredService<IQuizScoringService>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        if (session.CurrentQuestionNumber >= session.TotalQuestions)
        {
            // Quiz is completed
            await CompleteQuizAsync(sessionId, ct);
            return null;
        }

        session.CurrentQuestionNumber += 1;
        session.Status = SessionStatus.Waiting;

        var nextQuestion = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        if (nextQuestion == null)
        {
            nextQuestion = await repo.CreateQuestionAsync(new QuizQuestion
            {
                SessionId = session.Id,
                QuestionNumber = session.CurrentQuestionNumber,
                Status = QuestionStatus.Pending
            }, ct);
        }
        else
        {
            nextQuestion.Status = QuestionStatus.Pending;
            nextQuestion.CorrectOption = null;
            nextQuestion.StartedAt = null;
            nextQuestion.VotingEndsAt = null;
            await repo.UpdateQuestionAsync(nextQuestion, ct);
        }

        await repo.UpdateSessionAsync(session, ct);

        // Update in-memory cache for the new question
        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.Status = SessionStatus.Waiting;
            cache.CurrentQuestionNumber = session.CurrentQuestionNumber;
            cache.ActiveQuestionId = nextQuestion.Id;
            cache.StartedAt = null;
            cache.VotingEndsAt = null;
            cache.Submissions.Clear();
        }

        var nextDto = new NextQuestionHubDto
        {
            QuestionNumber = session.CurrentQuestionNumber,
            TotalQuestions = session.TotalQuestions
        };

        await _hubContext.Clients.Group($"session_{session.SessionCode}").NextQuestion(nextDto);

        // Broadcast leaderboard
        var leaderboard = await scoringService.GetLiveScoreboardAsync(session.Id, ct);
        await _hubContext.Clients.Group($"session_{session.SessionCode}").ScoreboardUpdated(leaderboard);

        return nextDto;
    }

    public async Task<FinalScoreboardDto> CompleteQuizAsync(Guid sessionId, CancellationToken ct = default)
    {
        // Cancel active server timer
        if (_activeTimers.TryRemove(sessionId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }

        // Flush any pending submissions
        await _answerQueue.FlushAsync(sessionId, ct);

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
        var scoringService = scope.ServiceProvider.GetRequiredService<IQuizScoringService>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        session.Status = SessionStatus.Completed;
        session.EndedAt = DateTime.UtcNow;
        await repo.UpdateSessionAsync(session, ct);

        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.Status = SessionStatus.Completed;
        }

        var finalScoreboard = await scoringService.GetFinalScoreboardAsync(sessionId, ct);

        await _hubContext.Clients.Group($"session_{session.SessionCode}").QuizCompleted(finalScoreboard);

        return finalScoreboard;
    }

    public async Task<QuestionCancelledHubDto> CancelQuestionAsync(Guid sessionId, int questionNumber, string? reason = null, CancellationToken ct = default)
    {
        // Cancel countdown timer if running
        if (_activeTimers.TryRemove(sessionId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
        var scoringService = scope.ServiceProvider.GetRequiredService<IQuizScoringService>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var success = await repo.CancelQuestionAsync(sessionId, questionNumber, ct);
        if (!success)
        {
            throw new KeyNotFoundException($"Question #{questionNumber} not found in session.");
        }

        // Reset in-memory cache submissions
        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.Status = SessionStatus.Waiting;
            cache.Submissions.Clear();
        }

        var updatedScoreboard = await scoringService.GetLiveScoreboardAsync(sessionId, ct);
        var reasonText = string.IsNullOrWhiteSpace(reason) ? "Host cancelled this question due to verification or adjustment." : reason.Trim();

        var cancelDto = new QuestionCancelledHubDto
        {
            QuestionNumber = questionNumber,
            Reason = reasonText,
            Message = $"Question #{questionNumber} has been voided by the host. All submitted answers have been cleared and points reverted.",
            UpdatedScoreboard = updatedScoreboard
        };

        // Broadcast to contestants and admin
        await _hubContext.Clients.Group($"session_{session.SessionCode}").QuestionCancelled(cancelDto);
        await _hubContext.Clients.Group($"admin_{session.SessionCode}").QuestionCancelled(cancelDto);
        await _hubContext.Clients.Group($"session_{session.SessionCode}").ScoreboardUpdated(updatedScoreboard);
        await _hubContext.Clients.Group($"admin_{session.SessionCode}").ScoreboardUpdated(updatedScoreboard);

        return cancelDto;
    }

    public async Task<SubmitAnswerResponse> SubmitAnswerAsync(
        string sessionCode, 
        Guid participantId, 
        int selectedOption, 
        CancellationToken ct = default)
    {
        var serverReceivedAt = DateTime.UtcNow;

        if (selectedOption < 1 || selectedOption > 4)
        {
            return new SubmitAnswerResponse
            {
                Success = false,
                Message = "Invalid option. Must be between 1 and 4."
            };
        }

        try
        {
            // 1. Instant sub-millisecond in-memory cache lookup
            var normalizedCode = sessionCode.Trim().ToUpperInvariant();
            var cache = await GetOrRefreshCacheAsync(normalizedCode, ct);

            // 2. Validate Participant belongs to session
            if (!cache.EnrolledParticipants.TryGetValue(participantId, out var participantName))
            {
                // Fallback: Check DB if participant just enrolled in parallel
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
                var p = await repo.GetParticipantByIdAsync(participantId, ct);
                if (p == null || p.SessionId != cache.SessionId)
                {
                    return new SubmitAnswerResponse { Success = false, Message = "Participant not recognized for this session." };
                }
                participantName = p.FullName;
                cache.EnrolledParticipants[p.Id] = participantName;
            }

            // 3. Validate Session and Question Status
            if (cache.Status != SessionStatus.Voting)
            {
                return new SubmitAnswerResponse { Success = false, Message = "Voting is not currently active." };
            }

            // 4. Authoritative Server-Side Timeout Check (grace window of 500ms for network transit)
            if (cache.VotingEndsAt.HasValue && serverReceivedAt > cache.VotingEndsAt.Value.AddMilliseconds(500))
            {
                return new SubmitAnswerResponse { Success = false, Message = "Time's up. Answer arrived after voting closed." };
            }

            // 5. Calculate official server response time in milliseconds
            var startedAt = cache.StartedAt ?? serverReceivedAt.AddSeconds(-cache.DurationSeconds);
            var responseMs = Math.Max(1.0, (serverReceivedAt - startedAt).TotalMilliseconds);

            // 6. Thread-Safe Duplicate Prevention in Memory (< 0.001ms)
            if (!cache.Submissions.TryAdd(participantId, (selectedOption, responseMs, serverReceivedAt)))
            {
                var existing = cache.Submissions[participantId];
                return new SubmitAnswerResponse
                {
                    Success = false,
                    Message = "Answer has already been submitted for this question.",
                    SelectedOption = existing.SelectedOption,
                    ResponseMilliseconds = existing.ResponseMs,
                    ServerReceivedAt = existing.ServerReceivedAt
                };
            }

            // 7. Create Entity & Enqueue for Asynchronous Background Batch Persistence
            var answer = new QuizAnswer
            {
                SessionId = cache.SessionId,
                QuestionId = cache.ActiveQuestionId,
                ParticipantId = participantId,
                SelectedOption = selectedOption,
                ServerReceivedAt = serverReceivedAt,
                ResponseMilliseconds = responseMs
            };

            await _answerQueue.EnqueueAnswerAsync(answer, ct);

            // 8. Real-time broadcast to Admin console
            var totalAnswered = cache.Submissions.Count;
            var totalParticipants = Math.Max(cache.TotalParticipants, cache.EnrolledParticipants.Count);

            _ = _hubContext.Clients.Group($"admin_{cache.SessionCode}").AnswerSubmitted(new AnswerSubmittedHubDto
            {
                ParticipantId = participantId,
                ParticipantName = participantName,
                TotalAnswered = totalAnswered,
                TotalParticipants = totalParticipants,
                ResponseMilliseconds = responseMs
            });

            return new SubmitAnswerResponse
            {
                Success = true,
                Message = "Answer submitted successfully.",
                SelectedOption = selectedOption,
                ResponseMilliseconds = responseMs,
                ServerReceivedAt = serverReceivedAt
            };
        }
        catch (Exception ex)
        {
            await _errorLogger.LogErrorAsync(
                "Voting", 
                $"Submission error for participant {participantId} in session {sessionCode}: {ex.Message}", 
                ex, 
                null, 
                sessionCode, 
                "Error", 
                $"ParticipantId: {participantId}, Option: {selectedOption}");

            return new SubmitAnswerResponse
            {
                Success = false,
                Message = "Server encountered a transient error while receiving answer. Retrying..."
            };
        }
    }

    public async Task<ParticipantStateDto> RenameParticipantAsync(string sessionCode, Guid participantId, string newFullName, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var participant = await repo.GetParticipantByIdAsync(participantId, ct)
            ?? throw new KeyNotFoundException("Participant not found");

        if (participant.HasRenamed)
        {
            throw new InvalidOperationException("Name can only be changed once per tournament session.");
        }

        if (string.IsNullOrWhiteSpace(newFullName))
        {
            throw new ArgumentException("Name cannot be empty.");
        }

        var cleanName = newFullName.Trim();
        var previousName = participant.FullName;

        participant.PreviousFullName = previousName;
        participant.FullName = cleanName;
        participant.HasRenamed = true;

        await repo.UpdateParticipantAsync(participant, ct);

        // Update in-memory cache
        var normalizedCode = sessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache))
        {
            cache.EnrolledParticipants[participantId] = cleanName;
        }

        // Broadcast to both session and admin groups
        await _hubContext.Clients.Group($"session_{sessionCode}").ParticipantRenamed(participantId, cleanName, previousName);
        await _hubContext.Clients.Group($"admin_{sessionCode}").ParticipantRenamed(participantId, cleanName, previousName);

        return await GetParticipantStateAsync(sessionCode, participantId, ct);
    }

    public async Task<ParticipantStateDto> GetParticipantStateAsync(string sessionCode, Guid participantId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByCodeAsync(sessionCode, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var participant = await repo.GetParticipantByIdAsync(participantId, ct)
            ?? throw new KeyNotFoundException("Participant not found");

        var question = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        QuizAnswer? answer = null;
        if (question != null)
        {
            answer = await repo.GetAnswerAsync(question.Id, participantId, ct);
        }

        return new ParticipantStateDto
        {
            ParticipantId = participant.Id,
            FullName = participant.FullName,
            PreviousFullName = participant.PreviousFullName,
            HasRenamed = participant.HasRenamed,
            SessionCode = session.SessionCode,
            SessionName = session.SessionName,
            SessionStatus = session.Status,
            CurrentQuestionNumber = session.CurrentQuestionNumber,
            TotalQuestions = session.TotalQuestions,
            CurrentQuestionStatus = question?.Status,
            VotingEndsAt = question?.VotingEndsAt,
            DurationSeconds = session.QuestionDurationSeconds > 0 ? session.QuestionDurationSeconds : 15,
            HasSubmittedAnswer = answer != null,
            SubmittedOption = answer?.SelectedOption,
            CorrectOption = question?.CorrectOption,
            IsCorrect = answer?.IsCorrect,
            IsFastest = answer?.IsFastest ?? false,
            PointsAwarded = answer?.PointsAwarded ?? 0,
            TotalScore = participant.TotalScore,
            Rank = participant.Rank,
            IsKicked = false
        };
    }

    public async Task<SessionDetailDto> GetSessionDetailAsync(Guid sessionId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var participants = await repo.GetParticipantsBySessionIdAsync(sessionId, ct);
        var activeQuestion = await repo.GetQuestionByNumberAsync(sessionId, session.CurrentQuestionNumber, ct);

        int answeredCount = 0;
        var normalizedCode = session.SessionCode.Trim().ToUpperInvariant();
        if (_sessionCaches.TryGetValue(normalizedCode, out var cache) && cache.ActiveQuestionId == activeQuestion?.Id)
        {
            answeredCount = cache.Submissions.Count;
        }
        else if (activeQuestion != null)
        {
            answeredCount = (await repo.GetAnswersForQuestionAsync(activeQuestion.Id, ct)).Count;
        }

        return new SessionDetailDto
        {
            Id = session.Id,
            SessionCode = session.SessionCode,
            SessionName = session.SessionName,
            Status = session.Status,
            TotalQuestions = session.TotalQuestions,
            CurrentQuestionNumber = session.CurrentQuestionNumber,
            QuestionDurationSeconds = session.QuestionDurationSeconds,
            CorrectAnswerPoints = session.CorrectAnswerPoints,
            FastestAnswerBonus = session.FastestAnswerBonus,
            RevealResults = session.RevealResults,
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            ParticipantCount = participants.Count,
            ActiveQuestionNumber = activeQuestion?.QuestionNumber ?? session.CurrentQuestionNumber,
            ActiveQuestionStatus = activeQuestion?.Status,
            ActiveQuestionVotingEndsAt = activeQuestion?.VotingEndsAt,
            ActiveQuestionAnsweredCount = answeredCount
        };
    }
}

using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using QuizMaster.Api.Hubs;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Core.Enums;
using QuizMaster.Core.Hubs;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Services;

public interface IQuizSessionManager
{
    Task<QuizSession> StartSessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<VotingStartedHubDto> StartVotingAsync(Guid sessionId, CancellationToken ct = default);
    Task<VotingEndedHubDto> EndVotingAsync(Guid sessionId, CancellationToken ct = default);
    Task<QuestionResultHubDto> SetCorrectAnswerAsync(Guid sessionId, int correctOption, CancellationToken ct = default);
    Task<NextQuestionHubDto?> NextQuestionAsync(Guid sessionId, CancellationToken ct = default);
    Task<FinalScoreboardDto> CompleteQuizAsync(Guid sessionId, CancellationToken ct = default);
    Task<SubmitAnswerResponse> SubmitAnswerAsync(string sessionCode, Guid participantId, int selectedOption, CancellationToken ct = default);
    Task<ParticipantStateDto> RenameParticipantAsync(string sessionCode, Guid participantId, string newFullName, CancellationToken ct = default);
    Task<ParticipantStateDto> GetParticipantStateAsync(string sessionCode, Guid participantId, CancellationToken ct = default);
    Task<SessionDetailDto> GetSessionDetailAsync(Guid sessionId, CancellationToken ct = default);
}

public class QuizSessionManager : IQuizSessionManager
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<QuizHub, IQuizHubClient> _hubContext;
    private static readonly ConcurrentDictionary<Guid, CancellationTokenSource> _activeTimers = new();

    public QuizSessionManager(
        IServiceScopeFactory scopeFactory,
        IHubContext<QuizHub, IQuizHubClient> hubContext)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
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
                Console.WriteLine($"Error in automatic voting timer for session {sessionId}: {ex.Message}");
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

        var answers = await repo.GetAnswersForQuestionAsync(questionId);
        var participants = await repo.GetParticipantsBySessionIdAsync(sessionId);

        var summaryDto = new VotingEndedHubDto
        {
            QuestionNumber = questionNumber,
            TotalAnswered = answers.Count,
            TotalParticipants = participants.Count
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

        var question = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        if (question != null)
        {
            question.Status = QuestionStatus.VotingEnded;
            await repo.UpdateQuestionAsync(question, ct);
        }

        session.Status = SessionStatus.VotingEnded;
        await repo.UpdateSessionAsync(session, ct);

        var answers = question != null 
            ? await repo.GetAnswersForQuestionAsync(question.Id, ct) 
            : new List<QuizAnswer>();
        var participants = await repo.GetParticipantsBySessionIdAsync(session.Id, ct);

        var summaryDto = new VotingEndedHubDto
        {
            QuestionNumber = session.CurrentQuestionNumber,
            TotalAnswered = answers.Count,
            TotalParticipants = participants.Count
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

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
        var scoringService = scope.ServiceProvider.GetRequiredService<IQuizScoringService>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

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
            await repo.CreateQuestionAsync(new QuizQuestion
            {
                SessionId = session.Id,
                QuestionNumber = session.CurrentQuestionNumber,
                Status = QuestionStatus.Pending
            }, ct);
        }

        await repo.UpdateSessionAsync(session, ct);

        var nextDto = new NextQuestionHubDto
        {
            QuestionNumber = session.CurrentQuestionNumber,
            TotalQuestions = session.TotalQuestions
        };

        await _hubContext.Clients.Group($"session_{session.SessionCode}").NextQuestion(nextDto);

        return nextDto;
    }

    public async Task<FinalScoreboardDto> CompleteQuizAsync(Guid sessionId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();
        var scoringService = scope.ServiceProvider.GetRequiredService<IQuizScoringService>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        session.Status = SessionStatus.Completed;
        session.EndedAt = DateTime.UtcNow;
        await repo.UpdateSessionAsync(session, ct);

        var finalScoreboard = await scoringService.GetFinalScoreboardAsync(sessionId, ct);

        await _hubContext.Clients.Group($"session_{session.SessionCode}").QuizCompleted(finalScoreboard);

        return finalScoreboard;
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

        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByCodeAsync(sessionCode, ct);
        if (session == null)
        {
            return new SubmitAnswerResponse { Success = false, Message = "Session not found." };
        }

        var participant = await repo.GetParticipantByIdAsync(participantId, ct);
        if (participant == null || participant.SessionId != session.Id)
        {
            return new SubmitAnswerResponse { Success = false, Message = "Participant not recognized for this session." };
        }

        if (session.Status != SessionStatus.Voting)
        {
            return new SubmitAnswerResponse { Success = false, Message = "Voting is not currently active." };
        }

        var question = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        if (question == null || question.Status != QuestionStatus.Voting)
        {
            return new SubmitAnswerResponse { Success = false, Message = "Question is not currently open for voting." };
        }

        // Authoritative Server-Side Timeout Check
        if (question.VotingEndsAt.HasValue && serverReceivedAt > question.VotingEndsAt.Value)
        {
            return new SubmitAnswerResponse { Success = false, Message = "Time's up. Answer arrived after voting closed." };
        }

        // Check for duplicate answer
        var existingAnswer = await repo.GetAnswerAsync(question.Id, participantId, ct);
        if (existingAnswer != null)
        {
            return new SubmitAnswerResponse
            {
                Success = false,
                Message = "Answer has already been submitted for this question.",
                SelectedOption = existingAnswer.SelectedOption,
                ResponseMilliseconds = existingAnswer.ResponseMilliseconds,
                ServerReceivedAt = existingAnswer.ServerReceivedAt
            };
        }

        // Calculate official server response time in milliseconds
        var startedAt = question.StartedAt ?? session.CreatedAt;
        var responseMs = Math.Max(1.0, (serverReceivedAt - startedAt).TotalMilliseconds);

        var answer = new QuizAnswer
        {
            SessionId = session.Id,
            QuestionId = question.Id,
            ParticipantId = participantId,
            SelectedOption = selectedOption,
            ServerReceivedAt = serverReceivedAt,
            ResponseMilliseconds = responseMs
        };

        await repo.RecordAnswerAsync(answer, ct);

        var totalAnswered = (await repo.GetAnswersForQuestionAsync(question.Id, ct)).Count;
        var totalParticipants = (await repo.GetParticipantsBySessionIdAsync(session.Id, ct)).Count;

        // Broadcast to admin in real-time
        await _hubContext.Clients.Group($"admin_{session.SessionCode}").AnswerSubmitted(new AnswerSubmittedHubDto
        {
            ParticipantId = participant.Id,
            ParticipantName = participant.FullName,
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

        var activeQuestion = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        QuizAnswer? answer = null;
        if (activeQuestion != null)
        {
            answer = await repo.GetAnswerAsync(activeQuestion.Id, participantId, ct);
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
            CurrentQuestionStatus = activeQuestion?.Status,
            VotingEndsAt = activeQuestion?.VotingEndsAt,
            DurationSeconds = session.QuestionDurationSeconds,
            HasSubmittedAnswer = answer != null,
            SubmittedOption = answer?.SelectedOption,
            CorrectOption = session.RevealResults || session.Status == SessionStatus.Completed ? activeQuestion?.CorrectOption : null,
            IsCorrect = answer?.IsCorrect,
            IsFastest = answer?.IsFastest ?? false,
            PointsAwarded = answer?.PointsAwarded ?? 0,
            TotalScore = participant.TotalScore,
            Rank = participant.Rank
        };
    }

    public async Task<SessionDetailDto> GetSessionDetailAsync(Guid sessionId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuizRepository>();

        var session = await repo.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var activeQuestion = await repo.GetQuestionByNumberAsync(session.Id, session.CurrentQuestionNumber, ct);
        var answers = activeQuestion != null ? await repo.GetAnswersForQuestionAsync(activeQuestion.Id, ct) : new List<QuizAnswer>();

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
            ParticipantCount = session.Participants.Count,
            ActiveQuestionNumber = session.CurrentQuestionNumber,
            ActiveQuestionStatus = activeQuestion?.Status,
            ActiveQuestionVotingEndsAt = activeQuestion?.VotingEndsAt,
            ActiveQuestionAnsweredCount = answers.Count
        };
    }
}

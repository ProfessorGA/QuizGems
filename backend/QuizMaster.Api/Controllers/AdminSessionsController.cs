using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using QuizMaster.Api.Hubs;
using QuizMaster.Api.Services;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Core.Enums;
using QuizMaster.Core.Hubs;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Controllers;

[ApiController]
[Route("api/admin/sessions")]
[Authorize]
public class AdminSessionsController : ControllerBase
{
    private readonly IQuizRepository _repository;
    private readonly IQuizSessionManager _sessionManager;
    private readonly IQuizScoringService _scoringService;
    private readonly IHubContext<QuizHub, IQuizHubClient> _hubContext;

    public AdminSessionsController(
        IQuizRepository repository,
        IQuizSessionManager sessionManager,
        IQuizScoringService scoringService,
        IHubContext<QuizHub, IQuizHubClient> hubContext)
    {
        _repository = repository;
        _sessionManager = sessionManager;
        _scoringService = scoringService;
        _hubContext = hubContext;
    }

    [HttpPost]
    public async Task<ActionResult<SessionDetailDto>> CreateSession([FromBody] CreateSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionName))
        {
            return BadRequest(new { message = "Session name is required." });
        }

        var code = string.IsNullOrWhiteSpace(request.SessionCode)
            ? Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()
            : request.SessionCode.Trim().ToUpperInvariant();

        var existing = await _repository.GetSessionByCodeAsync(code);
        if (existing != null && !string.IsNullOrWhiteSpace(request.SessionCode))
        {
            return Conflict(new { message = $"Session code '{code}' already exists. Please choose a unique code." });
        }
        while (existing != null)
        {
            code = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
            existing = await _repository.GetSessionByCodeAsync(code);
        }

        var session = new QuizSession
        {
            SessionName = request.SessionName.Trim(),
            SessionCode = code,
            TotalQuestions = request.TotalQuestions > 0 ? request.TotalQuestions : 25,
            QuestionDurationSeconds = request.QuestionDurationSeconds > 0 ? request.QuestionDurationSeconds : 15,
            CorrectAnswerPoints = request.CorrectAnswerPoints > 0 ? request.CorrectAnswerPoints : 10,
            FastestAnswerBonus = request.FastestAnswerBonus >= 0 ? request.FastestAnswerBonus : 5,
            RevealResults = request.RevealResults,
            Status = SessionStatus.Created
        };

        await _repository.CreateSessionAsync(session);

        var detail = await _sessionManager.GetSessionDetailAsync(session.Id);
        return CreatedAtAction(nameof(GetSessionById), new { id = session.Id }, detail);
    }

    [HttpGet]
    public async Task<ActionResult<List<SessionListItemDto>>> GetAllSessions()
    {
        try
        {
            var sessions = await _repository.GetAllSessionsAsync();
            var dtos = sessions.Select(s => new SessionListItemDto
            {
                Id = s.Id,
                SessionCode = s.SessionCode,
                SessionName = s.SessionName,
                Status = s.Status,
                TotalQuestions = s.TotalQuestions,
                CurrentQuestionNumber = s.CurrentQuestionNumber,
                ParticipantCount = s.Participants.Count,
                CreatedAt = s.CreatedAt
            }).ToList();

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error retrieving quiz sessions from database.", details = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SessionDetailDto>> GetSessionById(Guid id)
    {
        try
        {
            var detail = await _sessionManager.GetSessionDetailAsync(id);
            return Ok(detail);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpPost("{id:guid}/start")]
    public async Task<ActionResult<SessionDetailDto>> StartSession(Guid id)
    {
        try
        {
            await _sessionManager.StartSessionAsync(id);
            var detail = await _sessionManager.GetSessionDetailAsync(id);
            return Ok(detail);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:guid}/participants")]
    public async Task<ActionResult<List<ParticipantHubDto>>> GetParticipants(Guid id)
    {
        var session = await _repository.GetSessionByIdAsync(id);
        if (session == null) return NotFound(new { message = "Session not found." });

        var participants = await _repository.GetParticipantsBySessionIdAsync(id);
        var activeQuestion = await _repository.GetQuestionByNumberAsync(id, session.CurrentQuestionNumber);
        var answers = activeQuestion != null ? await _repository.GetAnswersForQuestionAsync(activeQuestion.Id) : new List<QuizAnswer>();
        var answerMap = answers.ToDictionary(a => a.ParticipantId);

        var dtos = participants.Select(p =>
        {
            answerMap.TryGetValue(p.Id, out var ans);
            return new ParticipantHubDto
            {
                Id = p.Id,
                FullName = p.FullName,
                IsConnected = p.IsConnected,
                TotalScore = p.TotalScore,
                Rank = p.Rank,
                HasAnsweredCurrentQuestion = ans != null,
                SubmittedOption = (session.Status == SessionStatus.AnswerReveal || session.Status == SessionStatus.Completed) ? ans?.SelectedOption : null,
                ResponseMilliseconds = ans?.ResponseMilliseconds
            };
        }).ToList();

        return Ok(dtos);
    }

    [HttpPost("{id:guid}/voting/start")]
    public async Task<ActionResult<VotingStartedHubDto>> StartVoting(Guid id)
    {
        try
        {
            var votingDto = await _sessionManager.StartVotingAsync(id);
            return Ok(votingDto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/voting/end")]
    public async Task<ActionResult<VotingEndedHubDto>> EndVoting(Guid id)
    {
        try
        {
            var summary = await _sessionManager.EndVotingAsync(id);
            return Ok(summary);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpPost("{id:guid}/correct-answer")]
    public async Task<ActionResult<QuestionResultHubDto>> SetCorrectAnswer(Guid id, [FromBody] SetCorrectAnswerRequest request)
    {
        try
        {
            var result = await _sessionManager.SetCorrectAnswerAsync(id, request.CorrectOption);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/next-question")]
    public async Task<ActionResult> NextQuestion(Guid id)
    {
        try
        {
            var next = await _sessionManager.NextQuestionAsync(id);
            if (next == null)
            {
                var final = await _scoringService.GetFinalScoreboardAsync(id);
                return Ok(new { completed = true, finalScoreboard = final });
            }
            return Ok(new { completed = false, nextQuestion = next });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<FinalScoreboardDto>> CompleteQuiz(Guid id)
    {
        try
        {
            var final = await _sessionManager.CompleteQuizAsync(id);
            return Ok(final);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpGet("{id:guid}/scoreboard")]
    public async Task<ActionResult<List<ScoreboardEntryDto>>> GetScoreboard(Guid id)
    {
        var session = await _repository.GetSessionByIdAsync(id);
        if (session == null) return NotFound(new { message = "Session not found." });

        var leaderboard = await _scoringService.GetLiveScoreboardAsync(id);
        return Ok(leaderboard);
    }

    [HttpGet("{id:guid}/results")]
    public async Task<ActionResult<FinalScoreboardDto>> GetResults(Guid id)
    {
        try
        {
            var final = await _scoringService.GetFinalScoreboardAsync(id);
            return Ok(final);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpPost("{id:guid}/restart")]
    public async Task<IActionResult> RestartQuiz(Guid id)
    {
        var session = await _repository.GetSessionByIdAsync(id);
        if (session == null) return NotFound(new { message = "Session not found." });

        var sessionCode = session.SessionCode;
        await _repository.RestartQuizSessionAsync(id);

        var scoreboard = await _scoringService.GetLiveScoreboardAsync(id);
        await _hubContext.Clients.Group($"session_{sessionCode}").ScoreboardUpdated(scoreboard);
        await _hubContext.Clients.Group($"admin_{sessionCode}").ScoreboardUpdated(scoreboard);

        var sessionState = new SessionStateHubDto
        {
            SessionId = session.Id,
            SessionCode = session.SessionCode,
            SessionName = session.SessionName,
            Status = SessionStatus.Waiting,
            CurrentQuestionNumber = 1,
            TotalQuestions = session.TotalQuestions,
            QuestionDurationSeconds = session.QuestionDurationSeconds,
            ParticipantCount = session.Participants.Count
        };
        await _hubContext.Clients.Group($"session_{sessionCode}").SessionStarted(sessionState);

        var updated = await _sessionManager.GetSessionDetailAsync(id);
        return Ok(new
        {
            message = $"Quiz '{sessionCode}' has been restarted fresh from Question 1. All contestants remain connected with scores reset to 0.",
            session = updated
        });
    }

    [HttpPost("{id:guid}/reset-participants")]
    public async Task<IActionResult> ResetParticipants(Guid id)
    {
        return await RestartQuiz(id);
    }

    [HttpGet("{id:guid}/participants/{participantId:guid}/audit")]
    public async Task<ActionResult<ParticipantAuditDto>> GetParticipantAudit(Guid id, Guid participantId)
    {
        try
        {
            var audit = await _scoringService.GetParticipantAuditAsync(id, participantId);
            return Ok(audit);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session or contestant not found." });
        }
    }

    [HttpGet("{id:guid}/export-excel")]
    public async Task<IActionResult> ExportExcelResults(Guid id)
    {
        try
        {
            var session = await _repository.GetSessionByIdAsync(id);
            if (session == null) return NotFound(new { message = "Session not found." });

            var excelBytes = await _scoringService.ExportResultsExcelAsync(id);
            var filename = $"Quiz_Results_{session.SessionCode}_{DateTime.UtcNow.AddHours(5).AddMinutes(30):yyyyMMdd_HHmmss}.xlsx";

            return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpPost("{id:guid}/terminate")]
    public async Task<ActionResult<FinalScoreboardDto>> TerminateSession(Guid id)
    {
        try
        {
            var final = await _sessionManager.CompleteQuizAsync(id);
            return Ok(final);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpPost("{id:guid}/participants/{participantId:guid}/kick")]
    public async Task<IActionResult> KickParticipant(Guid id, Guid participantId, [FromBody] KickReasonRequest? request)
    {
        var session = await _repository.GetSessionByIdAsync(id);
        if (session == null) return NotFound(new { message = "Session not found." });

        var reason = request?.Reason ?? "Removed by tournament host for anti-cheat verification or policy violation.";
        var kicked = await _repository.KickParticipantAsync(participantId);
        if (!kicked) return NotFound(new { message = "Participant not found." });

        // Notify kicked participant and whole room
        await _hubContext.Clients.Group($"session_{session.SessionCode}").ParticipantKicked(participantId, reason);

        var scoreboard = await _scoringService.GetLiveScoreboardAsync(id);
        await _hubContext.Clients.Group($"session_{session.SessionCode}").ScoreboardUpdated(scoreboard);
        await _hubContext.Clients.Group($"admin_{session.SessionCode}").ScoreboardUpdated(scoreboard);

        return Ok(new { message = "Contestant successfully kicked from session." });
    }

    [HttpPost("{id:guid}/participants/bulk-kick")]
    public async Task<IActionResult> BulkKickParticipants(Guid id, [FromBody] BulkKickRequest request)
    {
        var session = await _repository.GetSessionByIdAsync(id);
        if (session == null) return NotFound(new { message = "Session not found." });

        if (request?.ParticipantIds == null || request.ParticipantIds.Count == 0)
        {
            return BadRequest(new { message = "No contestants selected." });
        }

        var reason = request.Reason ?? "Removed by tournament host.";
        var count = await _repository.BulkKickParticipantsAsync(id, request.ParticipantIds);

        foreach (var pid in request.ParticipantIds)
        {
            await _hubContext.Clients.Group($"session_{session.SessionCode}").ParticipantKicked(pid, reason);
        }

        var scoreboard = await _scoringService.GetLiveScoreboardAsync(id);
        await _hubContext.Clients.Group($"session_{session.SessionCode}").ScoreboardUpdated(scoreboard);
        await _hubContext.Clients.Group($"admin_{session.SessionCode}").ScoreboardUpdated(scoreboard);

        return Ok(new { message = $"Successfully kicked {count} contestant(s)." });
    }

    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> ExportResults(Guid id)
    {
        try
        {
            var session = await _repository.GetSessionByIdAsync(id);
            if (session == null) return NotFound(new { message = "Session not found." });

            var csvBytes = await _scoringService.ExportResultsCsvAsync(id);
            var filename = $"Quiz_Results_{session.SessionCode}_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";

            return File(csvBytes, "text/csv", filename);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session not found." });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSession(Guid id)
    {
        var session = await _repository.GetSessionByIdAsync(id);
        if (session == null) return NotFound(new { message = "Session not found." });

        var sessionCode = session.SessionCode;
        var deleted = await _repository.DeleteSessionAsync(id);
        if (!deleted) return BadRequest(new { message = "Failed to delete session." });

        // Broadcast to clients in session
        await _hubContext.Clients.Group($"session_{sessionCode}").SessionDeleted(sessionCode);

        return Ok(new { message = $"Session '{sessionCode}' and all temporary competition data were successfully deleted." });
    }
}

public class KickReasonRequest
{
    public string? Reason { get; set; }
}

public class BulkKickRequest
{
    public List<Guid> ParticipantIds { get; set; } = new();
    public string? Reason { get; set; }
}

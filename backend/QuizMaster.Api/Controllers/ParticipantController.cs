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
[Route("api/participant")]
public class ParticipantController : ControllerBase
{
    private readonly IQuizRepository _repository;
    private readonly IQuizSessionManager _sessionManager;
    private readonly IHubContext<QuizHub, IQuizHubClient> _hubContext;

    public ParticipantController(
        IQuizRepository repository,
        IQuizSessionManager sessionManager,
        IHubContext<QuizHub, IQuizHubClient> hubContext)
    {
        _repository = repository;
        _sessionManager = sessionManager;
        _hubContext = hubContext;
    }

    [HttpPost("join")]
    public async Task<ActionResult<JoinSessionResponse>> JoinSession([FromBody] JoinSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionCode))
        {
            return BadRequest(new { message = "Session code is required." });
        }

        if (string.IsNullOrWhiteSpace(request.FullName) || request.FullName.Trim().Length < 2)
        {
            return BadRequest(new { message = "Please enter your full name (at least 2 characters)." });
        }

        var normalizedCode = request.SessionCode.Trim().ToUpperInvariant();
        var session = await _repository.GetSessionByCodeAsync(normalizedCode);
        if (session == null)
        {
            return NotFound(new { message = $"Session code '{normalizedCode}' not found. Please check and try again." });
        }

        if (session.Status == SessionStatus.Completed)
        {
            return BadRequest(new { message = "This quiz session has already completed." });
        }

        var trimmedName = request.FullName.Trim();

        // Check if participant already registered
        var existingParticipant = await _repository.GetParticipantByNameAsync(session.Id, trimmedName);
        QuizParticipant participant;

        if (existingParticipant != null)
        {
            // Reconnect existing participant
            participant = existingParticipant;
            participant.IsConnected = true;
            participant.LastConnectedAt = DateTime.UtcNow;
            await _repository.UpdateParticipantAsync(participant);
        }
        else
        {
            participant = new QuizParticipant
            {
                SessionId = session.Id,
                FullName = trimmedName,
                IsConnected = true,
                JoinedAt = DateTime.UtcNow,
                LastConnectedAt = DateTime.UtcNow
            };
            await _repository.AddParticipantAsync(participant);
        }

        // Notify Admin of participant joined
        await _hubContext.Clients.Group($"admin_{normalizedCode}").ParticipantJoined(new ParticipantHubDto
        {
            Id = participant.Id,
            FullName = participant.FullName,
            IsConnected = true,
            TotalScore = participant.TotalScore,
            Rank = participant.Rank,
            HasAnsweredCurrentQuestion = false
        });

        return Ok(new JoinSessionResponse
        {
            ParticipantId = participant.Id,
            SessionId = session.Id,
            SessionCode = session.SessionCode,
            SessionName = session.SessionName,
            FullName = participant.FullName,
            SessionStatus = session.Status,
            CurrentQuestionNumber = session.CurrentQuestionNumber,
            TotalQuestions = session.TotalQuestions,
            QuestionDurationSeconds = session.QuestionDurationSeconds
        });
    }

    [HttpGet("session/{sessionCode}/state/{participantId:guid}")]
    public async Task<ActionResult<ParticipantStateDto>> GetParticipantState(string sessionCode, Guid participantId)
    {
        try
        {
            var state = await _sessionManager.GetParticipantStateAsync(sessionCode, participantId);
            return Ok(state);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session or participant not found." });
        }
    }

    [HttpPost("rename")]
    public async Task<ActionResult<ParticipantStateDto>> RenameParticipant([FromBody] RenameParticipantRequest request)
    {
        try
        {
            var updated = await _sessionManager.RenameParticipantAsync(request.SessionCode, request.ParticipantId, request.NewFullName);
            return Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Session or participant not found." });
        }
    }

    [HttpPost("answer")]
    public async Task<ActionResult<SubmitAnswerResponse>> SubmitAnswer([FromBody] SubmitAnswerRequest request)
    {
        var response = await _sessionManager.SubmitAnswerAsync(request.SessionCode, request.ParticipantId, request.SelectedOption);
        if (!response.Success)
        {
            return BadRequest(response);
        }

        return Ok(response);
    }
}

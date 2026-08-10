using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using QuizMaster.Api.Services;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Hubs;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Hubs;

public class QuizHub : Hub<IQuizHubClient>
{
    private readonly IQuizRepository _repository;
    private readonly IQuizSessionManager _sessionManager;
    private static readonly ConcurrentDictionary<string, (Guid ParticipantId, string SessionCode, string FullName)> _connectionMap = new();

    public QuizHub(IQuizRepository repository, IQuizSessionManager sessionManager)
    {
        _repository = repository;
        _sessionManager = sessionManager;
    }

    public async Task JoinSessionGroup(string sessionCode, Guid? participantId, bool isAdmin)
    {
        var normalizedCode = sessionCode.Trim().ToUpperInvariant();
        await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{normalizedCode}");

        if (isAdmin)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"admin_{normalizedCode}");
            return;
        }

        if (participantId.HasValue && participantId.Value != Guid.Empty)
        {
            var participant = await _repository.GetParticipantByIdAsync(participantId.Value);
            if (participant != null)
            {
                _connectionMap[Context.ConnectionId] = (participant.Id, normalizedCode, participant.FullName);
                await _repository.UpdateParticipantConnectionAsync(participant.Id, Context.ConnectionId, true);

                await Clients.Group($"admin_{normalizedCode}").ParticipantReconnected(participant.Id, participant.FullName);
            }
        }
    }

    public async Task<SubmitAnswerResponse> SubmitAnswer(string sessionCode, Guid participantId, int selectedOption)
    {
        return await _sessionManager.SubmitAnswerAsync(sessionCode, participantId, selectedOption);
    }

    public async Task<ParticipantStateDto?> ReconnectParticipant(string sessionCode, Guid participantId)
    {
        var normalizedCode = sessionCode.Trim().ToUpperInvariant();
        var participant = await _repository.GetParticipantByIdAsync(participantId);
        if (participant == null) return null;

        _connectionMap[Context.ConnectionId] = (participant.Id, normalizedCode, participant.FullName);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{normalizedCode}");
        await _repository.UpdateParticipantConnectionAsync(participant.Id, Context.ConnectionId, true);

        await Clients.Group($"admin_{normalizedCode}").ParticipantReconnected(participant.Id, participant.FullName);

        return await _sessionManager.GetParticipantStateAsync(normalizedCode, participantId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connectionMap.TryRemove(Context.ConnectionId, out var connectionInfo))
        {
            try
            {
                await _repository.UpdateParticipantConnectionAsync(connectionInfo.ParticipantId, null, false);
                await Clients.Group($"admin_{connectionInfo.SessionCode}").ParticipantDisconnected(connectionInfo.ParticipantId, connectionInfo.FullName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating disconnect status: {ex.Message}");
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}

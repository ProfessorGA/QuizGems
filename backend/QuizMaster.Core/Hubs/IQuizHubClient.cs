using QuizMaster.Core.DTOs;

namespace QuizMaster.Core.Hubs;

public interface IQuizHubClient
{
    Task ParticipantJoined(ParticipantHubDto participant);
    Task ParticipantDisconnected(Guid participantId, string fullName);
    Task ParticipantReconnected(Guid participantId, string fullName);
    Task ParticipantRenamed(Guid participantId, string newFullName, string previousFullName);
    Task ParticipantKicked(Guid participantId, string reason);
    Task SessionStarted(SessionStateHubDto sessionState);
    Task VotingStarted(VotingStartedHubDto votingState);
    Task VotingEnded(VotingEndedHubDto votingSummary);
    Task AnswerSubmitted(AnswerSubmittedHubDto notification);
    Task AnswerRevealed(AnswerRevealedHubDto reveal);
    Task QuestionResult(QuestionResultHubDto result);
    Task ScoreboardUpdated(List<ScoreboardEntryDto> leaderboard);
    Task NextQuestion(NextQuestionHubDto nextQuestion);
    Task QuizCompleted(FinalScoreboardDto finalScoreboard);
    Task SessionReset(string sessionCode);
    Task SessionDeleted(string sessionCode);
    Task ErrorNotification(string message);
}

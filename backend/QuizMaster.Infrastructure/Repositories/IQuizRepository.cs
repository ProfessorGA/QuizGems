using QuizMaster.Core.Entities;
using QuizMaster.Core.Enums;

namespace QuizMaster.Infrastructure.Repositories;

public interface IQuizRepository
{
    // Sessions
    Task<QuizSession?> GetSessionByIdAsync(Guid id, CancellationToken ct = default);
    Task<QuizSession?> GetSessionByCodeAsync(string sessionCode, CancellationToken ct = default);
    Task<List<QuizSession>> GetAllSessionsAsync(CancellationToken ct = default);
    Task<QuizSession> CreateSessionAsync(QuizSession session, CancellationToken ct = default);
    Task UpdateSessionAsync(QuizSession session, CancellationToken ct = default);
    Task<bool> DeleteSessionAsync(Guid id, CancellationToken ct = default);

    // Participants
    Task<QuizParticipant?> GetParticipantByIdAsync(Guid id, CancellationToken ct = default);
    Task<QuizParticipant?> GetParticipantByNameAsync(Guid sessionId, string fullName, CancellationToken ct = default);
    Task<List<QuizParticipant>> GetParticipantsBySessionIdAsync(Guid sessionId, CancellationToken ct = default);
    Task<QuizParticipant> AddParticipantAsync(QuizParticipant participant, CancellationToken ct = default);
    Task UpdateParticipantAsync(QuizParticipant participant, CancellationToken ct = default);
    Task UpdateParticipantConnectionAsync(Guid participantId, string? connectionId, bool isConnected, CancellationToken ct = default);
    Task<bool> KickParticipantAsync(Guid participantId, CancellationToken ct = default);
    Task<int> BulkKickParticipantsAsync(Guid sessionId, IEnumerable<Guid> participantIds, CancellationToken ct = default);

    // Questions
    Task<QuizQuestion?> GetQuestionByNumberAsync(Guid sessionId, int questionNumber, CancellationToken ct = default);
    Task<QuizQuestion?> GetActiveQuestionAsync(Guid sessionId, CancellationToken ct = default);
    Task<QuizQuestion> CreateQuestionAsync(QuizQuestion question, CancellationToken ct = default);
    Task UpdateQuestionAsync(QuizQuestion question, CancellationToken ct = default);
    Task<List<QuizQuestion>> GetQuestionsBySessionIdAsync(Guid sessionId, CancellationToken ct = default);

    // Answers
    Task<QuizAnswer?> GetAnswerAsync(Guid questionId, Guid participantId, CancellationToken ct = default);
    Task<List<QuizAnswer>> GetAnswersForQuestionAsync(Guid questionId, CancellationToken ct = default);
    Task<List<QuizAnswer>> GetAnswersForSessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<QuizAnswer> RecordAnswerAsync(QuizAnswer answer, CancellationToken ct = default);
    Task UpdateAnswersBatchAsync(IEnumerable<QuizAnswer> answers, CancellationToken ct = default);
    Task SaveAnswersBatchAsync(IEnumerable<QuizAnswer> answers, CancellationToken ct = default);

    // Admin & Session Maintenance
    Task<AdminUser?> GetAdminByUsernameAsync(string username, CancellationToken ct = default);
    Task CreateAdminAsync(AdminUser admin, CancellationToken ct = default);
    Task EnsureDatabaseCreatedAsync(CancellationToken ct = default);
    Task ClearParticipantsAndAnswersAsync(Guid sessionId, CancellationToken ct = default);
    Task RestartQuizSessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<bool> CancelQuestionAsync(Guid sessionId, int questionNumber, CancellationToken ct = default);

    // System Diagnostics & Error Logging
    Task LogSystemErrorAsync(SystemErrorLog log, CancellationToken ct = default);
    Task<List<SystemErrorLog>> GetSystemLogsAsync(Guid? sessionId = null, int limit = 100, CancellationToken ct = default);
}

using Microsoft.EntityFrameworkCore;
using QuizMaster.Core.Entities;
using QuizMaster.Core.Enums;
using QuizMaster.Infrastructure.Data;

namespace QuizMaster.Infrastructure.Repositories;

public class QuizRepository : IQuizRepository
{
    private readonly QuizDbContext _context;

    public QuizRepository(QuizDbContext context)
    {
        _context = context;
    }

    public async Task<QuizSession?> GetSessionByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Sessions
            .Include(s => s.Participants)
            .Include(s => s.Questions)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
    }

    public async Task<QuizSession?> GetSessionByCodeAsync(string sessionCode, CancellationToken ct = default)
    {
        var normalized = sessionCode.Trim().ToUpperInvariant();
        return await _context.Sessions
            .Include(s => s.Participants)
            .Include(s => s.Questions)
            .FirstOrDefaultAsync(s => s.SessionCode == normalized, ct);
    }

    public async Task<List<QuizSession>> GetAllSessionsAsync(CancellationToken ct = default)
    {
        return await _context.Sessions
            .Include(s => s.Participants)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<QuizSession> CreateSessionAsync(QuizSession session, CancellationToken ct = default)
    {
        session.SessionCode = session.SessionCode.Trim().ToUpperInvariant();
        _context.Sessions.Add(session);
        await _context.SaveChangesAsync(ct);
        return session;
    }

    public async Task UpdateSessionAsync(QuizSession session, CancellationToken ct = default)
    {
        _context.Sessions.Update(session);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteSessionAsync(Guid id, CancellationToken ct = default)
    {
        var session = await _context.Sessions.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (session == null) return false;

        _context.Sessions.Remove(session);
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<QuizParticipant?> GetParticipantByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Participants
            .Include(p => p.Session)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<QuizParticipant?> GetParticipantByNameAsync(Guid sessionId, string fullName, CancellationToken ct = default)
    {
        var normalized = fullName.Trim();
        return await _context.Participants
            .FirstOrDefaultAsync(p => p.SessionId == sessionId && p.FullName.ToLower() == normalized.ToLower(), ct);
    }

    public async Task<List<QuizParticipant>> GetParticipantsBySessionIdAsync(Guid sessionId, CancellationToken ct = default)
    {
        return await _context.Participants
            .Where(p => p.SessionId == sessionId)
            .OrderByDescending(p => p.TotalScore)
            .ThenBy(p => p.JoinedAt)
            .ToListAsync(ct);
    }

    public async Task<QuizParticipant> AddParticipantAsync(QuizParticipant participant, CancellationToken ct = default)
    {
        _context.Participants.Add(participant);
        await _context.SaveChangesAsync(ct);
        return participant;
    }

    public async Task UpdateParticipantAsync(QuizParticipant participant, CancellationToken ct = default)
    {
        _context.Participants.Update(participant);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateParticipantConnectionAsync(Guid participantId, string? connectionId, bool isConnected, CancellationToken ct = default)
    {
        var participant = await _context.Participants.FindAsync(new object[] { participantId }, ct);
        if (participant != null)
        {
            participant.IsConnected = isConnected;
            if (connectionId != null)
            {
                participant.ConnectionId = connectionId;
            }
            participant.LastConnectedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
        }
    }

    public async Task<QuizQuestion?> GetQuestionByNumberAsync(Guid sessionId, int questionNumber, CancellationToken ct = default)
    {
        return await _context.Questions
            .Include(q => q.Answers)
            .FirstOrDefaultAsync(q => q.SessionId == sessionId && q.QuestionNumber == questionNumber, ct);
    }

    public async Task<QuizQuestion?> GetActiveQuestionAsync(Guid sessionId, CancellationToken ct = default)
    {
        return await _context.Questions
            .Include(q => q.Answers)
            .Where(q => q.SessionId == sessionId && (q.Status == QuestionStatus.Voting || q.Status == QuestionStatus.VotingEnded))
            .OrderByDescending(q => q.QuestionNumber)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<QuizQuestion> CreateQuestionAsync(QuizQuestion question, CancellationToken ct = default)
    {
        _context.Questions.Add(question);
        await _context.SaveChangesAsync(ct);
        return question;
    }

    public async Task UpdateQuestionAsync(QuizQuestion question, CancellationToken ct = default)
    {
        _context.Questions.Update(question);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<List<QuizQuestion>> GetQuestionsBySessionIdAsync(Guid sessionId, CancellationToken ct = default)
    {
        return await _context.Questions
            .Include(q => q.Answers)
            .Where(q => q.SessionId == sessionId)
            .OrderBy(q => q.QuestionNumber)
            .ToListAsync(ct);
    }

    public async Task<QuizAnswer?> GetAnswerAsync(Guid questionId, Guid participantId, CancellationToken ct = default)
    {
        return await _context.Answers
            .FirstOrDefaultAsync(a => a.QuestionId == questionId && a.ParticipantId == participantId, ct);
    }

    public async Task<List<QuizAnswer>> GetAnswersForQuestionAsync(Guid questionId, CancellationToken ct = default)
    {
        return await _context.Answers
            .Include(a => a.Participant)
            .Where(a => a.QuestionId == questionId)
            .OrderBy(a => a.ResponseMilliseconds)
            .ToListAsync(ct);
    }

    public async Task<List<QuizAnswer>> GetAnswersForSessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        return await _context.Answers
            .Include(a => a.Participant)
            .Include(a => a.Question)
            .Where(a => a.SessionId == sessionId)
            .OrderBy(a => a.Question.QuestionNumber)
            .ThenBy(a => a.ResponseMilliseconds)
            .ToListAsync(ct);
    }

    public async Task<QuizAnswer> RecordAnswerAsync(QuizAnswer answer, CancellationToken ct = default)
    {
        _context.Answers.Add(answer);
        await _context.SaveChangesAsync(ct);
        return answer;
    }

    public async Task UpdateAnswersBatchAsync(IEnumerable<QuizAnswer> answers, CancellationToken ct = default)
    {
        _context.Answers.UpdateRange(answers);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<AdminUser?> GetAdminByUsernameAsync(string username, CancellationToken ct = default)
    {
        var normalized = username.Trim().ToLowerInvariant();
        return await _context.AdminUsers
            .FirstOrDefaultAsync(u => u.Username.ToLower() == normalized, ct);
    }

    public async Task CreateAdminAsync(AdminUser admin, CancellationToken ct = default)
    {
        _context.AdminUsers.Add(admin);
        await _context.SaveChangesAsync(ct);
    }

    public async Task EnsureDatabaseCreatedAsync(CancellationToken ct = default)
    {
        await _context.Database.EnsureCreatedAsync(ct);
    }
}

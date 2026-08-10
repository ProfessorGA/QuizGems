using QuizMaster.Core.Enums;

namespace QuizMaster.Core.Entities;

public class QuizQuestion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public int QuestionNumber { get; set; }
    public int? CorrectOption { get; set; } // 1, 2, 3, or 4; set after reveal
    public QuestionStatus Status { get; set; } = QuestionStatus.Pending;
    public DateTime? StartedAt { get; set; }
    public DateTime? VotingEndsAt { get; set; }
    public DateTime? ScoredAt { get; set; }

    // Navigation properties
    public QuizSession Session { get; set; } = null!;
    public ICollection<QuizAnswer> Answers { get; set; } = new List<QuizAnswer>();
}

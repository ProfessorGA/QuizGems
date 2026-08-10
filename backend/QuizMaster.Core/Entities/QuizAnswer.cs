namespace QuizMaster.Core.Entities;

public class QuizAnswer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid ParticipantId { get; set; }
    public int SelectedOption { get; set; } // 1, 2, 3, or 4
    public DateTime ServerReceivedAt { get; set; } = DateTime.UtcNow;
    public double ResponseMilliseconds { get; set; }
    public bool? IsCorrect { get; set; }
    public bool IsFastest { get; set; } = false;
    public int PointsAwarded { get; set; } = 0;

    // Navigation properties
    public QuizSession Session { get; set; } = null!;
    public QuizQuestion Question { get; set; } = null!;
    public QuizParticipant Participant { get; set; } = null!;
}

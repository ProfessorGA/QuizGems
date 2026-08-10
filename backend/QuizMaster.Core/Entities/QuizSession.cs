using QuizMaster.Core.Enums;

namespace QuizMaster.Core.Entities;

public class QuizSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public SessionStatus Status { get; set; } = SessionStatus.Created;
    public int TotalQuestions { get; set; } = 25;
    public int CurrentQuestionNumber { get; set; } = 0;
    public int QuestionDurationSeconds { get; set; } = 15;
    public int CorrectAnswerPoints { get; set; } = 10;
    public int FastestAnswerBonus { get; set; } = 5;
    public bool RevealResults { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }

    // Navigation properties
    public ICollection<QuizParticipant> Participants { get; set; } = new List<QuizParticipant>();
    public ICollection<QuizQuestion> Questions { get; set; } = new List<QuizQuestion>();
    public ICollection<QuizAnswer> Answers { get; set; } = new List<QuizAnswer>();
}

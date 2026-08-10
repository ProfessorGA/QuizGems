namespace QuizMaster.Core.Entities;

public class QuizParticipant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? ConnectionId { get; set; }
    public bool IsConnected { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastConnectedAt { get; set; } = DateTime.UtcNow;
    public int TotalScore { get; set; } = 0;
    public int Rank { get; set; } = 1;

    // Navigation properties
    public QuizSession Session { get; set; } = null!;
    public ICollection<QuizAnswer> Answers { get; set; } = new List<QuizAnswer>();
}

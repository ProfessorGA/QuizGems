namespace QuizMaster.Core.Entities;

public class SystemErrorLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? SessionId { get; set; }
    public string? SessionCode { get; set; }
    public string Category { get; set; } = "General"; // Voting, SignalR, Database, Scoring, Auth, Network
    public string Severity { get; set; } = "Error";   // Info, Warning, Error, Critical
    public string ErrorMessage { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    public string? ContextData { get; set; } // JSON or key details
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    public DateTime TimestampIst { get; set; } = DateTime.UtcNow.AddHours(5).AddMinutes(30);

    // Navigation property
    public QuizSession? Session { get; set; }
}

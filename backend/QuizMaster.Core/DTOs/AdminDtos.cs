using QuizMaster.Core.Enums;

namespace QuizMaster.Core.DTOs;

public class AdminLoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AdminLoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class CreateSessionRequest
{
    public string SessionName { get; set; } = string.Empty;
    public string SessionCode { get; set; } = string.Empty;
    public int TotalQuestions { get; set; } = 25;
    public int QuestionDurationSeconds { get; set; } = 15;
    public int CorrectAnswerPoints { get; set; } = 10;
    public int FastestAnswerBonus { get; set; } = 5;
    public bool RevealResults { get; set; } = true;
}

public class SetCorrectAnswerRequest
{
    public int CorrectOption { get; set; } // 1, 2, 3, or 4
}

public class CancelQuestionRequest
{
    public string? Reason { get; set; }
}

public class SessionDetailDto
{
    public Guid Id { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public int TotalQuestions { get; set; }
    public int CurrentQuestionNumber { get; set; }
    public int QuestionDurationSeconds { get; set; }
    public int CorrectAnswerPoints { get; set; }
    public int FastestAnswerBonus { get; set; }
    public bool RevealResults { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int ParticipantCount { get; set; }
    public int ActiveQuestionNumber { get; set; }
    public QuestionStatus? ActiveQuestionStatus { get; set; }
    public DateTime? ActiveQuestionVotingEndsAt { get; set; }
    public int? ActiveQuestionAnsweredCount { get; set; }
}

public class SessionListItemDto
{
    public Guid Id { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public int TotalQuestions { get; set; }
    public int CurrentQuestionNumber { get; set; }
    public int ParticipantCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ParticipantAuditDto
{
    public Guid ParticipantId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? PreviousFullName { get; set; }
    public bool HasRenamed { get; set; }
    public bool IsConnected { get; set; }
    public int TotalScore { get; set; }
    public int Rank { get; set; }
    public int TotalCorrect { get; set; }
    public int TotalFastest { get; set; }
    public double TotalResponseSeconds { get; set; }
    public DateTime JoinedAt { get; set; }
    public string JoinedAtIst { get; set; } = string.Empty;
    public List<ParticipantQuestionAuditDto> QuestionBreakdown { get; set; } = new();
}

public class ParticipantQuestionAuditDto
{
    public int QuestionNumber { get; set; }
    public int? SelectedOption { get; set; }
    public int? CorrectOption { get; set; }
    public bool IsCorrect { get; set; }
    public bool IsFastest { get; set; }
    public int PointsAwarded { get; set; }
    public double? ResponseSeconds { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public string SubmittedAtIst { get; set; } = string.Empty;
}

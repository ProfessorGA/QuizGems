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

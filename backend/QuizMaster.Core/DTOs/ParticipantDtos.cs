using QuizMaster.Core.Enums;

namespace QuizMaster.Core.DTOs;

public class JoinSessionRequest
{
    public string SessionCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
}

public class JoinSessionResponse
{
    public Guid ParticipantId { get; set; }
    public Guid SessionId { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PreviousFullName { get; set; }
    public bool HasRenamed { get; set; }
    public bool IsReentry { get; set; }
    public string? ReentryMessage { get; set; }
    public SessionStatus SessionStatus { get; set; }
    public int CurrentQuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public int QuestionDurationSeconds { get; set; }
}

public class RenameParticipantRequest
{
    public string SessionCode { get; set; } = string.Empty;
    public Guid ParticipantId { get; set; }
    public string NewFullName { get; set; } = string.Empty;
}

public class SubmitAnswerRequest
{
    public Guid ParticipantId { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public int SelectedOption { get; set; } // 1, 2, 3, 4
}

public class SubmitAnswerResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int SelectedOption { get; set; }
    public double ResponseMilliseconds { get; set; }
    public DateTime ServerReceivedAt { get; set; }
}

public class ParticipantStateDto
{
    public Guid ParticipantId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? PreviousFullName { get; set; }
    public bool HasRenamed { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public SessionStatus SessionStatus { get; set; }
    public int CurrentQuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public QuestionStatus? CurrentQuestionStatus { get; set; }
    public DateTime? VotingEndsAt { get; set; }
    public int DurationSeconds { get; set; }
    public bool HasSubmittedAnswer { get; set; }
    public int? SubmittedOption { get; set; }
    public int? CorrectOption { get; set; }
    public bool? IsCorrect { get; set; }
    public bool IsFastest { get; set; }
    public int PointsAwarded { get; set; }
    public int TotalScore { get; set; }
    public int Rank { get; set; }
    public bool IsKicked { get; set; } = false;
}

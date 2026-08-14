using QuizMaster.Core.Enums;

namespace QuizMaster.Core.DTOs;

public class ParticipantHubDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? PreviousFullName { get; set; }
    public bool HasRenamed { get; set; }
    public bool IsConnected { get; set; }
    public bool IsKicked { get; set; }
    public int TotalScore { get; set; }
    public int Rank { get; set; }
    public bool HasAnsweredCurrentQuestion { get; set; }
    public int? SubmittedOption { get; set; } // Revealed only after voting closes
    public double? ResponseMilliseconds { get; set; }
}

public class SessionStateHubDto
{
    public Guid SessionId { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public int CurrentQuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public int QuestionDurationSeconds { get; set; }
    public int ParticipantCount { get; set; }
}

public class VotingStartedHubDto
{
    public Guid QuestionId { get; set; }
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public int DurationSeconds { get; set; }
    public DateTime VotingStartedAtUtc { get; set; }
    public DateTime VotingEndsAtUtc { get; set; }
}

public class VotingEndedHubDto
{
    public int QuestionNumber { get; set; }
    public int TotalAnswered { get; set; }
    public int TotalParticipants { get; set; }
}

public class AnswerSubmittedHubDto
{
    public Guid ParticipantId { get; set; }
    public string ParticipantName { get; set; } = string.Empty;
    public int TotalAnswered { get; set; }
    public int TotalParticipants { get; set; }
    public double ResponseMilliseconds { get; set; }
}

public class AnswerRevealedHubDto
{
    public int QuestionNumber { get; set; }
    public int CorrectOption { get; set; } // 1, 2, 3, or 4
}

public class QuestionResultHubDto
{
    public int QuestionNumber { get; set; }
    public int CorrectOption { get; set; }
    public int TotalParticipants { get; set; }
    public int TotalAnswered { get; set; }
    public int CorrectCount { get; set; }
    public int WrongCount { get; set; }
    public int NoAnswerCount { get; set; }
    public OptionDistributionDto OptionDistribution { get; set; } = new();
    public FastestParticipantDto? FastestParticipant { get; set; }
    public List<ParticipantQuestionOutcomeDto> Outcomes { get; set; } = new();
}

public class OptionDistributionDto
{
    public int Option1 { get; set; }
    public int Option2 { get; set; }
    public int Option3 { get; set; }
    public int Option4 { get; set; }
}

public class FastestParticipantDto
{
    public Guid ParticipantId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public double ResponseMilliseconds { get; set; }
    public double ResponseSeconds => Math.Round(ResponseMilliseconds / 1000.0, 3);
    public int BonusPoints { get; set; }
}

public class ParticipantQuestionOutcomeDto
{
    public Guid ParticipantId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public int? SelectedOption { get; set; }
    public bool IsCorrect { get; set; }
    public bool IsFastest { get; set; }
    public int PointsEarned { get; set; }
    public double? ResponseMilliseconds { get; set; }
    public double? ResponseSeconds => ResponseMilliseconds.HasValue ? Math.Round(ResponseMilliseconds.Value / 1000.0, 3) : null;
}

public class NextQuestionHubDto
{
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
}

public class QuestionCancelledHubDto
{
    public int QuestionNumber { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public List<ScoreboardEntryDto> UpdatedScoreboard { get; set; } = new();
}

public class ParticipantReentryHubDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public int TotalScore { get; set; }
    public int Rank { get; set; }
    public DateTime ReenteredAtUtc { get; set; }
    public string Message { get; set; } = string.Empty;
}

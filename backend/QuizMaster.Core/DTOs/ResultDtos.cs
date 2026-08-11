namespace QuizMaster.Core.DTOs;

public class ScoreboardEntryDto
{
    public int Rank { get; set; }
    public Guid ParticipantId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? PreviousFullName { get; set; }
    public bool HasRenamed { get; set; }
    public int TotalScore { get; set; }
    public int CorrectAnswersCount { get; set; }
    public int FastestWinsCount { get; set; }
    public double TotalResponseSeconds { get; set; }
    public bool IsConnected { get; set; }
    public string Status { get; set; } = "Active";
}

public class FinalScoreboardDto
{
    public Guid SessionId { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public int TotalParticipants { get; set; }
    public int TotalAnswersSubmitted { get; set; }
    public int TotalCorrectAnswers { get; set; }
    public int TotalWrongAnswers { get; set; }
    public int TotalNoAnswers { get; set; }
    public List<ScoreboardEntryDto> Leaderboard { get; set; } = new();
    public List<FastestResponseHighlightDto> FastestResponses { get; set; } = new();
}

public class FastestResponseHighlightDto
{
    public int QuestionNumber { get; set; }
    public string ParticipantName { get; set; } = string.Empty;
    public double ResponseSeconds { get; set; }
    public int PointsAwarded { get; set; }
}

public class ParticipantExportRow
{
    public int Rank { get; set; }
    public string ParticipantName { get; set; } = string.Empty;
    public int TotalScore { get; set; }
    public int CorrectAnswers { get; set; }
    public int WrongAnswers { get; set; }
    public int NoAnswers { get; set; }
    public int FastestWins { get; set; }
}

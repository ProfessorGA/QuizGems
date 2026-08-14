using System.Text;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Infrastructure.Repositories;

namespace QuizMaster.Api.Services;

public interface IQuizScoringService
{
    Task<QuestionResultHubDto> ScoreQuestionAsync(QuizSession session, QuizQuestion question, int correctOption, CancellationToken ct = default);
    Task<List<ScoreboardEntryDto>> GetLiveScoreboardAsync(Guid sessionId, CancellationToken ct = default);
    Task<FinalScoreboardDto> GetFinalScoreboardAsync(Guid sessionId, CancellationToken ct = default);
    Task<ParticipantAuditDto> GetParticipantAuditAsync(Guid sessionId, Guid participantId, CancellationToken ct = default);
    Task<byte[]> ExportResultsCsvAsync(Guid sessionId, CancellationToken ct = default);
    Task<byte[]> ExportResultsExcelAsync(Guid sessionId, CancellationToken ct = default);
}

public class QuizScoringService : IQuizScoringService
{
    private readonly IQuizRepository _repository;

    public QuizScoringService(IQuizRepository repository)
    {
        _repository = repository;
    }

    public async Task<QuestionResultHubDto> ScoreQuestionAsync(
        QuizSession session, 
        QuizQuestion question, 
        int correctOption, 
        CancellationToken ct = default)
    {
        var answers = await _repository.GetAnswersForQuestionAsync(question.Id, ct);
        var participants = await _repository.GetParticipantsBySessionIdAsync(session.Id, ct);

        // Group by option for distribution
        var optionDist = new OptionDistributionDto
        {
            Option1 = answers.Count(a => a.SelectedOption == 1),
            Option2 = answers.Count(a => a.SelectedOption == 2),
            Option3 = answers.Count(a => a.SelectedOption == 3),
            Option4 = answers.Count(a => a.SelectedOption == 4)
        };

        // Identify correct answers sorted by ResponseMilliseconds
        var correctAnswers = answers
            .Where(a => a.SelectedOption == correctOption)
            .OrderBy(a => a.ResponseMilliseconds)
            .ThenBy(a => a.ServerReceivedAt)
            .ToList();

        var wrongAnswers = answers
            .Where(a => a.SelectedOption != correctOption)
            .ToList();

        // Process wrong answers
        foreach (var wrong in wrongAnswers)
        {
            wrong.IsCorrect = false;
            wrong.IsFastest = false;
            wrong.PointsAwarded = 0;
        }

        // Process correct answers & award speed-scaled points
        FastestParticipantDto? fastestDto = null;
        var durationMs = (session.QuestionDurationSeconds > 0 ? session.QuestionDurationSeconds : 15) * 1000.0;

        for (int i = 0; i < correctAnswers.Count; i++)
        {
            var correct = correctAnswers[i];
            correct.IsCorrect = true;

            // Scaled time bonus (1 to 5 points based on speed within duration)
            var speedBonus = (int)Math.Max(1, Math.Round(5.0 * (1.0 - Math.Min(1.0, correct.ResponseMilliseconds / durationMs))));

            if (i == 0)
            {
                correct.IsFastest = true;
                correct.PointsAwarded = session.CorrectAnswerPoints + session.FastestAnswerBonus;

                fastestDto = new FastestParticipantDto
                {
                    ParticipantId = correct.ParticipantId,
                    FullName = participants.FirstOrDefault(p => p.Id == correct.ParticipantId)?.FullName ?? correct.Participant?.FullName ?? string.Empty,
                    ResponseMilliseconds = correct.ResponseMilliseconds,
                    BonusPoints = session.FastestAnswerBonus
                };
            }
            else
            {
                correct.IsFastest = false;
                correct.PointsAwarded = session.CorrectAnswerPoints + speedBonus;
            }
        }

        // Save updated answers
        await _repository.UpdateAnswersBatchAsync(answers, ct);

        // Update total scores for participants
        var allSessionAnswers = await _repository.GetAnswersForSessionAsync(session.Id, ct);
        var scoresByParticipant = allSessionAnswers
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Sum(a => a.PointsAwarded));

        var participantResponseTimes = allSessionAnswers
            .Where(a => a.IsCorrect == true)
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Sum(a => a.ResponseMilliseconds));

        foreach (var participant in participants)
        {
            participant.TotalScore = scoresByParticipant.TryGetValue(participant.Id, out var totalScore) ? totalScore : 0;
        }

        // Recalculate ranks (Tie-break by total response time, then join time)
        var orderedParticipants = participants
            .OrderByDescending(p => p.TotalScore)
            .ThenBy(p => participantResponseTimes.TryGetValue(p.Id, out var t) ? t : double.MaxValue)
            .ThenBy(p => p.JoinedAt)
            .ToList();

        for (int i = 0; i < orderedParticipants.Count; i++)
        {
            orderedParticipants[i].Rank = i + 1;
            await _repository.UpdateParticipantAsync(orderedParticipants[i], ct);
        }

        // Build outcomes list
        var outcomes = new List<ParticipantQuestionOutcomeDto>();
        var answerMap = answers.ToDictionary(a => a.ParticipantId);

        foreach (var participant in participants)
        {
            if (answerMap.TryGetValue(participant.Id, out var ans))
            {
                outcomes.Add(new ParticipantQuestionOutcomeDto
                {
                    ParticipantId = participant.Id,
                    FullName = participant.FullName,
                    SelectedOption = ans.SelectedOption,
                    IsCorrect = ans.IsCorrect ?? false,
                    IsFastest = ans.IsFastest,
                    PointsEarned = ans.PointsAwarded,
                    ResponseMilliseconds = ans.ResponseMilliseconds
                });
            }
            else
            {
                outcomes.Add(new ParticipantQuestionOutcomeDto
                {
                    ParticipantId = participant.Id,
                    FullName = participant.FullName,
                    SelectedOption = null,
                    IsCorrect = false,
                    IsFastest = false,
                    PointsEarned = 0,
                    ResponseMilliseconds = null
                });
            }
        }

        return new QuestionResultHubDto
        {
            QuestionNumber = question.QuestionNumber,
            CorrectOption = correctOption,
            TotalParticipants = participants.Count,
            TotalAnswered = answers.Count,
            CorrectCount = correctAnswers.Count,
            WrongCount = wrongAnswers.Count,
            NoAnswerCount = Math.Max(0, participants.Count - answers.Count),
            OptionDistribution = optionDist,
            FastestParticipant = fastestDto,
            Outcomes = outcomes
        };
    }

    public async Task<List<ScoreboardEntryDto>> GetLiveScoreboardAsync(Guid sessionId, CancellationToken ct = default)
    {
        var participants = await _repository.GetParticipantsBySessionIdAsync(sessionId, ct);
        var answers = await _repository.GetAnswersForSessionAsync(sessionId, ct);

        var correctCounts = answers
            .Where(a => a.IsCorrect == true)
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Count());

        var fastestCounts = answers
            .Where(a => a.IsFastest)
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Count());

        var totalResponseTimes = answers
            .Where(a => a.IsCorrect == true)
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Sum(a => a.ResponseMilliseconds));

        var leaderboard = participants
            .OrderByDescending(p => p.TotalScore)
            .ThenBy(p => totalResponseTimes.TryGetValue(p.Id, out var t) ? t : double.MaxValue)
            .ThenByDescending(p => fastestCounts.TryGetValue(p.Id, out var f) ? f : 0)
            .ThenBy(p => p.JoinedAt)
            .Select((p, index) => new ScoreboardEntryDto
            {
                Rank = index + 1,
                ParticipantId = p.Id,
                FullName = p.FullName,
                PreviousFullName = p.PreviousFullName,
                HasRenamed = p.HasRenamed,
                TotalScore = p.TotalScore,
                CorrectAnswersCount = correctCounts.TryGetValue(p.Id, out var c) ? c : 0,
                FastestWinsCount = fastestCounts.TryGetValue(p.Id, out var f) ? f : 0,
                TotalResponseSeconds = Math.Round((totalResponseTimes.TryGetValue(p.Id, out var t) ? t : 0) / 1000.0, 2),
                IsConnected = p.IsConnected,
                Status = p.IsConnected ? "Active" : "Disconnected"
            })
            .ToList();

        return leaderboard;
    }

    public async Task<FinalScoreboardDto> GetFinalScoreboardAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await _repository.GetSessionByIdAsync(sessionId, ct);
        if (session == null) throw new InvalidOperationException("Session not found");

        var leaderboard = await GetLiveScoreboardAsync(sessionId, ct);
        var answers = await _repository.GetAnswersForSessionAsync(sessionId, ct);

        var fastestResponses = answers
            .Where(a => a.IsFastest)
            .OrderBy(a => a.Question.QuestionNumber)
            .Select(a => new FastestResponseHighlightDto
            {
                QuestionNumber = a.Question.QuestionNumber,
                ParticipantName = a.Participant.FullName,
                ResponseSeconds = Math.Round(a.ResponseMilliseconds / 1000.0, 3),
                PointsAwarded = a.PointsAwarded
            })
            .ToList();

        return new FinalScoreboardDto
        {
            SessionId = session.Id,
            SessionCode = session.SessionCode,
            SessionName = session.SessionName,
            TotalQuestions = session.TotalQuestions,
            TotalParticipants = leaderboard.Count,
            TotalAnswersSubmitted = answers.Count,
            TotalCorrectAnswers = answers.Count(a => a.IsCorrect == true),
            TotalWrongAnswers = answers.Count(a => a.IsCorrect == false),
            TotalNoAnswers = Math.Max(0, (session.TotalQuestions * leaderboard.Count) - answers.Count),
            Leaderboard = leaderboard,
            FastestResponses = fastestResponses
        };
    }

    public async Task<byte[]> ExportResultsCsvAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await _repository.GetSessionByIdAsync(sessionId, ct);
        if (session == null) throw new InvalidOperationException("Session not found");

        var leaderboard = await GetLiveScoreboardAsync(sessionId, ct);
        var answers = await _repository.GetAnswersForSessionAsync(sessionId, ct);

        var wrongCounts = answers
            .Where(a => a.IsCorrect == false)
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Count());

        var nowUtc = DateTime.UtcNow;
        var istTime = nowUtc.AddHours(5).AddMinutes(30);

        var csv = new StringBuilder();
        csv.AppendLine($"==========================================================================================");
        csv.AppendLine($"  GEMS QUIZ - OFFICIAL COMPETITION REPORT & AUDIT TRAIL");
        csv.AppendLine($"==========================================================================================");
        csv.AppendLine($"Session Name: {session.SessionName}");
        csv.AppendLine($"Session Code: {session.SessionCode}");
        csv.AppendLine($"Export Timestamp (IST): {istTime:yyyy-MM-dd HH:mm:ss.fff} (Indian Standard Time UTC+5:30)");
        csv.AppendLine($"Export Timestamp (UTC): {nowUtc:yyyy-MM-dd HH:mm:ss.fff} UTC");
        csv.AppendLine($"Configuration: Total Questions: {session.TotalQuestions} | Duration: {session.QuestionDurationSeconds}s | Base Points: {session.CorrectAnswerPoints} | Fastest Bonus: {session.FastestAnswerBonus}");
        csv.AppendLine($"Total Registered Contestants: {leaderboard.Count} | Total Answers Locked: {answers.Count}");
        csv.AppendLine();

        // Section 1: Official Final Standings
        csv.AppendLine($"------------------------------------------------------------------------------------------");
        csv.AppendLine($"  SECTION 1: OFFICIAL FINAL STANDINGS");
        csv.AppendLine($"------------------------------------------------------------------------------------------");
        csv.AppendLine("Rank,Participant Name,Total Points,Correct Answers,Wrong Answers,No Answers,Fastest Finger Wins,Final Status");

        foreach (var entry in leaderboard)
        {
            var wrong = wrongCounts.TryGetValue(entry.ParticipantId, out var w) ? w : 0;
            var noAnswers = Math.Max(0, session.CurrentQuestionNumber - entry.CorrectAnswersCount - wrong);
            var status = entry.IsConnected ? "Connected" : "Disconnected";
            var nameEscaped = $"\"{entry.FullName.Replace("\"", "\"\"")}\"";

            csv.AppendLine($"{entry.Rank},{nameEscaped},{entry.TotalScore},{entry.CorrectAnswersCount},{wrong},{noAnswers},{entry.FastestWinsCount},{status}");
        }

        csv.AppendLine();

        // Section 2: Question-by-Question Auditable Proof Log
        csv.AppendLine($"------------------------------------------------------------------------------------------");
        csv.AppendLine($"  SECTION 2: VERIFIABLE QUESTION-BY-QUESTION SUBMISSION LOG (PROOF & AUDIT)");
        csv.AppendLine($"------------------------------------------------------------------------------------------");
        csv.AppendLine("Question #,Participant Name,Selected Option,Result,Points Awarded,Response Time (s),Response Time (ms),Fastest Awarded,Server Received (IST Timestamp),Server Received (UTC Timestamp)");

        foreach (var a in answers.OrderBy(x => x.Question.QuestionNumber).ThenBy(x => x.ResponseMilliseconds))
        {
            var pName = $"\"{a.Participant?.FullName.Replace("\"", "\"\"") ?? "Contestant"}\"";
            var resultStr = a.IsCorrect == true ? "CORRECT" : (a.IsCorrect == false ? "INCORRECT" : "PENDING");
            var responseSec = (a.ResponseMilliseconds / 1000.0).ToString("F3");
            var isFastestStr = a.IsFastest ? "YES (FASTEST +5)" : "NO";
            var aIst = a.ServerReceivedAt.AddHours(5).AddMinutes(30);

            csv.AppendLine($"{a.Question.QuestionNumber},{pName},Option {a.SelectedOption},{resultStr},{a.PointsAwarded},{responseSec},{a.ResponseMilliseconds:F1},{isFastestStr},{aIst:yyyy-MM-dd HH:mm:ss.fff} IST,{a.ServerReceivedAt:yyyy-MM-dd HH:mm:ss.fff} UTC");
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var data = Encoding.UTF8.GetBytes(csv.ToString());
        var result = new byte[preamble.Length + data.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(data, 0, result, preamble.Length, data.Length);
        return result;
    }

    public async Task<ParticipantAuditDto> GetParticipantAuditAsync(Guid sessionId, Guid participantId, CancellationToken ct = default)
    {
        var session = await _repository.GetSessionByIdAsync(sessionId, ct)
            ?? throw new KeyNotFoundException("Session not found");

        var participant = await _repository.GetParticipantByIdAsync(participantId, ct)
            ?? throw new KeyNotFoundException("Participant not found");

        var questions = await _repository.GetQuestionsBySessionIdAsync(sessionId, ct);
        var answers = await _repository.GetAnswersForSessionAsync(sessionId, ct);

        var participantAnswers = answers.Where(a => a.ParticipantId == participantId).ToDictionary(a => a.QuestionId);

        var totalCorrect = answers.Count(a => a.ParticipantId == participantId && a.IsCorrect == true);
        var totalFastest = answers.Count(a => a.ParticipantId == participantId && a.IsFastest);
        var totalResponseMs = answers.Where(a => a.ParticipantId == participantId && a.IsCorrect == true).Sum(a => a.ResponseMilliseconds);

        var joinedIst = participant.JoinedAt.AddHours(5).AddMinutes(30);

        var breakdown = new List<ParticipantQuestionAuditDto>();

        foreach (var q in questions.OrderBy(q => q.QuestionNumber))
        {
            if (participantAnswers.TryGetValue(q.Id, out var ans))
            {
                var ansIst = ans.ServerReceivedAt.AddHours(5).AddMinutes(30);
                breakdown.Add(new ParticipantQuestionAuditDto
                {
                    QuestionNumber = q.QuestionNumber,
                    SelectedOption = ans.SelectedOption,
                    CorrectOption = q.CorrectOption,
                    IsCorrect = ans.IsCorrect ?? false,
                    IsFastest = ans.IsFastest,
                    PointsAwarded = ans.PointsAwarded,
                    ResponseSeconds = Math.Round(ans.ResponseMilliseconds / 1000.0, 3),
                    SubmittedAtUtc = ans.ServerReceivedAt,
                    SubmittedAtIst = $"{ansIst:yyyy-MM-dd HH:mm:ss.fff} IST"
                });
            }
            else
            {
                breakdown.Add(new ParticipantQuestionAuditDto
                {
                    QuestionNumber = q.QuestionNumber,
                    SelectedOption = null,
                    CorrectOption = q.CorrectOption,
                    IsCorrect = false,
                    IsFastest = false,
                    PointsAwarded = 0,
                    ResponseSeconds = null,
                    SubmittedAtUtc = null,
                    SubmittedAtIst = "No submission"
                });
            }
        }

        return new ParticipantAuditDto
        {
            ParticipantId = participant.Id,
            FullName = participant.FullName,
            PreviousFullName = participant.PreviousFullName,
            HasRenamed = participant.HasRenamed,
            IsConnected = participant.IsConnected,
            TotalScore = participant.TotalScore,
            Rank = participant.Rank,
            TotalCorrect = totalCorrect,
            TotalFastest = totalFastest,
            TotalResponseSeconds = Math.Round(totalResponseMs / 1000.0, 2),
            JoinedAt = participant.JoinedAt,
            JoinedAtIst = $"{joinedIst:yyyy-MM-dd HH:mm:ss} IST",
            QuestionBreakdown = breakdown
        };
    }

    public async Task<byte[]> ExportResultsExcelAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await _repository.GetSessionByIdAsync(sessionId, ct);
        if (session == null) throw new KeyNotFoundException("Session not found");

        var leaderboard = await GetLiveScoreboardAsync(sessionId, ct);
        var answers = await _repository.GetAnswersForSessionAsync(sessionId, ct);

        using var workbook = new ClosedXML.Excel.XLWorkbook();

        // Sheet 1: Leaderboard Standings
        var wsLeaderboard = workbook.Worksheets.Add("Final Standings");
        wsLeaderboard.Cell(1, 1).Value = "GEMS QUIZ - OFFICIAL FINAL STANDINGS";
        wsLeaderboard.Cell(1, 1).Style.Font.Bold = true;
        wsLeaderboard.Cell(1, 1).Style.Font.FontSize = 14;

        wsLeaderboard.Cell(2, 1).Value = $"Session: {session.SessionName} ({session.SessionCode})";
        wsLeaderboard.Cell(3, 1).Value = $"Generated: {DateTime.UtcNow.AddHours(5).AddMinutes(30):yyyy-MM-dd HH:mm:ss} IST";

        string[] lbHeaders = { "Rank", "Contestant Name", "Original Name", "Total Score (PTS)", "Correct Answers", "Fastest Finger Wins", "Total Time (s)", "Status" };
        for (int i = 0; i < lbHeaders.Length; i++)
        {
            var cell = wsLeaderboard.Cell(5, i + 1);
            cell.Value = lbHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromArgb(99, 102, 241);
            cell.Style.Font.FontColor = ClosedXML.Excel.XLColor.White;
        }

        int lbRow = 6;
        foreach (var p in leaderboard)
        {
            wsLeaderboard.Cell(lbRow, 1).Value = p.Rank;
            wsLeaderboard.Cell(lbRow, 2).Value = p.FullName;
            wsLeaderboard.Cell(lbRow, 3).Value = p.PreviousFullName ?? "-";
            wsLeaderboard.Cell(lbRow, 4).Value = p.TotalScore;
            wsLeaderboard.Cell(lbRow, 5).Value = p.CorrectAnswersCount;
            wsLeaderboard.Cell(lbRow, 6).Value = p.FastestWinsCount;
            wsLeaderboard.Cell(lbRow, 7).Value = p.TotalResponseSeconds;
            wsLeaderboard.Cell(lbRow, 8).Value = p.Status;
            lbRow++;
        }
        wsLeaderboard.Columns().AdjustToContents();

        // Sheet 2: Verifiable Audit Trail
        var wsAudit = workbook.Worksheets.Add("Verifiable Audit Log");
        wsAudit.Cell(1, 1).Value = "QUESTION-BY-QUESTION SUBMISSION AUDIT LOG";
        wsAudit.Cell(1, 1).Style.Font.Bold = true;
        wsAudit.Cell(1, 1).Style.Font.FontSize = 14;

        string[] auditHeaders = { "Question #", "Contestant Name", "Option Selected", "Correct Option", "Result", "Points Awarded", "Response Time (s)", "Fastest Bonus", "Timestamp IST" };
        for (int i = 0; i < auditHeaders.Length; i++)
        {
            var cell = wsAudit.Cell(3, i + 1);
            cell.Value = auditHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromArgb(16, 185, 129);
            cell.Style.Font.FontColor = ClosedXML.Excel.XLColor.White;
        }

        int auditRow = 4;
        foreach (var a in answers.OrderBy(x => x.Question.QuestionNumber).ThenBy(x => x.ResponseMilliseconds))
        {
            var aIst = a.ServerReceivedAt.AddHours(5).AddMinutes(30);
            wsAudit.Cell(auditRow, 1).Value = a.Question.QuestionNumber;
            wsAudit.Cell(auditRow, 2).Value = a.Participant?.FullName ?? "Contestant";
            wsAudit.Cell(auditRow, 3).Value = $"Option {a.SelectedOption}";
            wsAudit.Cell(auditRow, 4).Value = a.Question.CorrectOption.HasValue ? $"Option {a.Question.CorrectOption.Value}" : "-";
            wsAudit.Cell(auditRow, 5).Value = a.IsCorrect == true ? "CORRECT" : (a.IsCorrect == false ? "WRONG" : "PENDING");
            wsAudit.Cell(auditRow, 6).Value = a.PointsAwarded;
            wsAudit.Cell(auditRow, 7).Value = Math.Round(a.ResponseMilliseconds / 1000.0, 3);
            wsAudit.Cell(auditRow, 8).Value = a.IsFastest ? "YES (+5)" : "NO";
            wsAudit.Cell(auditRow, 9).Value = $"{aIst:yyyy-MM-dd HH:mm:ss.fff}";
            auditRow++;
        }
        wsAudit.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }
}

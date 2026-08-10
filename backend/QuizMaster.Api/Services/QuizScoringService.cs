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
    Task<byte[]> ExportResultsCsvAsync(Guid sessionId, CancellationToken ct = default);
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

        // Process correct answers & identify fastest
        FastestParticipantDto? fastestDto = null;
        for (int i = 0; i < correctAnswers.Count; i++)
        {
            var correct = correctAnswers[i];
            correct.IsCorrect = true;

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
                correct.PointsAwarded = session.CorrectAnswerPoints;
            }
        }

        // Save updated answers
        await _repository.UpdateAnswersBatchAsync(answers, ct);

        // Update total scores for participants
        var allSessionAnswers = await _repository.GetAnswersForSessionAsync(session.Id, ct);
        var scoresByParticipant = allSessionAnswers
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Sum(a => a.PointsAwarded));

        foreach (var participant in participants)
        {
            participant.TotalScore = scoresByParticipant.TryGetValue(participant.Id, out var totalScore) ? totalScore : 0;
        }

        // Recalculate ranks
        var orderedParticipants = participants
            .OrderByDescending(p => p.TotalScore)
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

        var leaderboard = participants
            .OrderByDescending(p => p.TotalScore)
            .ThenByDescending(p => fastestCounts.TryGetValue(p.Id, out var f) ? f : 0)
            .ThenBy(p => p.JoinedAt)
            .Select((p, index) => new ScoreboardEntryDto
            {
                Rank = index + 1,
                ParticipantId = p.Id,
                FullName = p.FullName,
                TotalScore = p.TotalScore,
                CorrectAnswersCount = correctCounts.TryGetValue(p.Id, out var c) ? c : 0,
                FastestWinsCount = fastestCounts.TryGetValue(p.Id, out var f) ? f : 0,
                IsConnected = p.IsConnected
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

        var csv = new StringBuilder();
        csv.AppendLine($"Physical Quiz Competition Results: {session.SessionName} ({session.SessionCode})");
        csv.AppendLine($"Export Date: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
        csv.AppendLine($"Total Questions: {session.TotalQuestions}, Duration: {session.QuestionDurationSeconds}s, Points: {session.CorrectAnswerPoints}, Fastest Bonus: {session.FastestAnswerBonus}");
        csv.AppendLine();
        csv.AppendLine("Rank,Participant Name,Total Score,Correct Answers,Wrong Answers,No Answers,Fastest Wins,Connection Status");

        foreach (var entry in leaderboard)
        {
            var wrong = wrongCounts.TryGetValue(entry.ParticipantId, out var w) ? w : 0;
            var noAnswers = Math.Max(0, session.CurrentQuestionNumber - entry.CorrectAnswersCount - wrong);
            var status = entry.IsConnected ? "Connected" : "Disconnected";
            var nameEscaped = $"\"{entry.FullName.Replace("\"", "\"\"")}\"";

            csv.AppendLine($"{entry.Rank},{nameEscaped},{entry.TotalScore},{entry.CorrectAnswersCount},{wrong},{noAnswers},{entry.FastestWinsCount},{status}");
        }

        return Encoding.UTF8.GetBytes(csv.ToString());
    }
}

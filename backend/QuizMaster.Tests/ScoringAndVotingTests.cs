using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Moq;
using QuizMaster.Api.Hubs;
using QuizMaster.Api.Services;
using QuizMaster.Core.DTOs;
using QuizMaster.Core.Entities;
using QuizMaster.Core.Enums;
using QuizMaster.Core.Hubs;
using QuizMaster.Infrastructure.Data;
using QuizMaster.Infrastructure.Repositories;
using Xunit;

namespace QuizMaster.Tests;

public class ScoringAndVotingTests
{
    private QuizDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<QuizDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new QuizDbContext(options);
    }

    [Fact]
    public async Task ScoringService_CalculatesCorrectPoints_AndFastestBonusAccurately()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var repo = new QuizRepository(context);
        var scoringService = new QuizScoringService(repo);

        var session = new QuizSession
        {
            SessionName = "GK Championship 2026",
            SessionCode = "GK26",
            TotalQuestions = 25,
            QuestionDurationSeconds = 15,
            CorrectAnswerPoints = 10,
            FastestAnswerBonus = 5
        };
        await repo.CreateSessionAsync(session);

        var pAlen = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Alen Mathew Zachariah" });
        var pRahul = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Rahul" });
        var pAnu = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Anu" });
        var pSidharth = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Sidharth" });
        var pPriya = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Priya" });

        var question = await repo.CreateQuestionAsync(new QuizQuestion
        {
            SessionId = session.Id,
            QuestionNumber = 1,
            Status = QuestionStatus.VotingEnded,
            StartedAt = DateTime.UtcNow.AddSeconds(-15),
            VotingEndsAt = DateTime.UtcNow
        });

        // Alen: Option 3 at 4482ms (Fastest Correct)
        await repo.RecordAnswerAsync(new QuizAnswer
        {
            SessionId = session.Id,
            QuestionId = question.Id,
            ParticipantId = pAlen.Id,
            SelectedOption = 3,
            ResponseMilliseconds = 4482,
            ServerReceivedAt = DateTime.UtcNow.AddSeconds(-10)
        });

        // Rahul: Option 3 at 5214ms (Correct)
        await repo.RecordAnswerAsync(new QuizAnswer
        {
            SessionId = session.Id,
            QuestionId = question.Id,
            ParticipantId = pRahul.Id,
            SelectedOption = 3,
            ResponseMilliseconds = 5214,
            ServerReceivedAt = DateTime.UtcNow.AddSeconds(-9)
        });

        // Anu: Option 3 at 7103ms (Correct)
        await repo.RecordAnswerAsync(new QuizAnswer
        {
            SessionId = session.Id,
            QuestionId = question.Id,
            ParticipantId = pAnu.Id,
            SelectedOption = 3,
            ResponseMilliseconds = 7103,
            ServerReceivedAt = DateTime.UtcNow.AddSeconds(-8)
        });

        // Sidharth: Option 1 at 6000ms (Wrong)
        await repo.RecordAnswerAsync(new QuizAnswer
        {
            SessionId = session.Id,
            QuestionId = question.Id,
            ParticipantId = pSidharth.Id,
            SelectedOption = 1,
            ResponseMilliseconds = 6000,
            ServerReceivedAt = DateTime.UtcNow.AddSeconds(-9)
        });

        // Priya: No Answer submitted

        // Act: Admin confirms Option 3 as correct
        var result = await scoringService.ScoreQuestionAsync(session, question, correctOption: 3);

        // Assert Question Result
        Assert.Equal(3, result.CorrectOption);
        Assert.Equal(5, result.TotalParticipants);
        Assert.Equal(4, result.TotalAnswered);
        Assert.Equal(3, result.CorrectCount);
        Assert.Equal(1, result.WrongCount);
        Assert.Equal(1, result.NoAnswerCount);

        // Fastest Participant verification
        Assert.NotNull(result.FastestParticipant);
        Assert.Equal(pAlen.Id, result.FastestParticipant.ParticipantId);
        Assert.Equal(5, result.FastestParticipant.BonusPoints);
        Assert.Equal(4.482, result.FastestParticipant.ResponseSeconds);

        // Leaderboard verification
        var leaderboard = await scoringService.GetLiveScoreboardAsync(session.Id);
        Assert.Equal(5, leaderboard.Count);

        // Alen: Rank 1, 15 Points (10 + 5)
        var entryAlen = leaderboard.First(e => e.ParticipantId == pAlen.Id);
        Assert.Equal(1, entryAlen.Rank);
        Assert.Equal(15, entryAlen.TotalScore);
        Assert.Equal(1, entryAlen.CorrectAnswersCount);
        Assert.Equal(1, entryAlen.FastestWinsCount);

        // Rahul: 13 Points (10 + 3 speed bonus)
        var entryRahul = leaderboard.First(e => e.ParticipantId == pRahul.Id);
        Assert.Equal(13, entryRahul.TotalScore);

        // Anu: 13 Points (10 + 3 speed bonus)
        var entryAnu = leaderboard.First(e => e.ParticipantId == pAnu.Id);
        Assert.Equal(13, entryAnu.TotalScore);

        // Sidharth: 0 Points
        var entrySidharth = leaderboard.First(e => e.ParticipantId == pSidharth.Id);
        Assert.Equal(0, entrySidharth.TotalScore);

        // Priya: 0 Points
        var entryPriya = leaderboard.First(e => e.ParticipantId == pPriya.Id);
        Assert.Equal(0, entryPriya.TotalScore);
    }

    [Fact]
    public async Task SessionManager_RejectsDuplicateAnswer()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var repo = new QuizRepository(context);

        var session = new QuizSession
        {
            SessionName = "Duplicate Test Session",
            SessionCode = "DUP1",
            Status = SessionStatus.Voting,
            CurrentQuestionNumber = 1,
            QuestionDurationSeconds = 15
        };
        await repo.CreateSessionAsync(session);

        var participant = await repo.AddParticipantAsync(new QuizParticipant
        {
            SessionId = session.Id,
            FullName = "Test Player"
        });

        var question = await repo.CreateQuestionAsync(new QuizQuestion
        {
            SessionId = session.Id,
            QuestionNumber = 1,
            Status = QuestionStatus.Voting,
            StartedAt = DateTime.UtcNow,
            VotingEndsAt = DateTime.UtcNow.AddSeconds(15)
        });

        var mockHubContext = new Mock<IHubContext<QuizHub, IQuizHubClient>>();
        var mockClients = new Mock<IHubClients<IQuizHubClient>>();
        var mockGroup = new Mock<IQuizHubClient>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockGroup.Object);
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);

        var services = new ServiceCollection();
        services.AddSingleton<IQuizRepository>(repo);
        services.AddSingleton<IQuizScoringService>(new QuizScoringService(repo));
        var sp = services.BuildServiceProvider();
        var scopeFactory = new Mock<IServiceScopeFactory>();
        var scope = new Mock<IServiceScope>();
        scope.Setup(s => s.ServiceProvider).Returns(sp);
        scopeFactory.Setup(f => f.CreateScope()).Returns(scope.Object);

        var sessionManager = new QuizSessionManager(scopeFactory.Object, mockHubContext.Object);

        // Act 1: First answer submission
        var firstAnswer = await sessionManager.SubmitAnswerAsync(session.SessionCode, participant.Id, selectedOption: 2);
        Assert.True(firstAnswer.Success);
        Assert.Equal(2, firstAnswer.SelectedOption);

        // Act 2: Duplicate answer submission
        var secondAnswer = await sessionManager.SubmitAnswerAsync(session.SessionCode, participant.Id, selectedOption: 4);

        // Assert duplicate is rejected
        Assert.False(secondAnswer.Success);
        Assert.Contains("already been submitted", secondAnswer.Message);
        Assert.Equal(2, secondAnswer.SelectedOption); // Remains Option 2
    }

    [Fact]
    public async Task SessionManager_RejectsLateAnswerAfterTimeout()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var repo = new QuizRepository(context);

        var session = new QuizSession
        {
            SessionName = "Timeout Test Session",
            SessionCode = "TIME1",
            Status = SessionStatus.Voting,
            CurrentQuestionNumber = 1,
            QuestionDurationSeconds = 15
        };
        await repo.CreateSessionAsync(session);

        var participant = await repo.AddParticipantAsync(new QuizParticipant
        {
            SessionId = session.Id,
            FullName = "Late Player"
        });

        // Question where VotingEndsAt is in the past
        var question = await repo.CreateQuestionAsync(new QuizQuestion
        {
            SessionId = session.Id,
            QuestionNumber = 1,
            Status = QuestionStatus.Voting,
            StartedAt = DateTime.UtcNow.AddSeconds(-20),
            VotingEndsAt = DateTime.UtcNow.AddSeconds(-5) // 5 seconds ago
        });

        var mockHubContext = new Mock<IHubContext<QuizHub, IQuizHubClient>>();
        var mockClients = new Mock<IHubClients<IQuizHubClient>>();
        var mockGroup = new Mock<IQuizHubClient>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockGroup.Object);
        mockHubContext.Setup(h => h.Clients).Returns(mockClients.Object);

        var services = new ServiceCollection();
        services.AddSingleton<IQuizRepository>(repo);
        services.AddSingleton<IQuizScoringService>(new QuizScoringService(repo));
        var sp = services.BuildServiceProvider();
        var scopeFactory = new Mock<IServiceScopeFactory>();
        var scope = new Mock<IServiceScope>();
        scope.Setup(s => s.ServiceProvider).Returns(sp);
        scopeFactory.Setup(f => f.CreateScope()).Returns(scope.Object);

        var sessionManager = new QuizSessionManager(scopeFactory.Object, mockHubContext.Object);

        // Act: Submit answer after official timeout
        var lateAnswer = await sessionManager.SubmitAnswerAsync(session.SessionCode, participant.Id, selectedOption: 1);

        // Assert late submission is strictly rejected
        Assert.False(lateAnswer.Success);
        Assert.Contains("Time's up", lateAnswer.Message);
    }

    [Fact]
    public async Task Session_CascadingDelete_RemovesAllRelatedData()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var repo = new QuizRepository(context);

        var session = await repo.CreateSessionAsync(new QuizSession
        {
            SessionName = "Temporary Event Session",
            SessionCode = "TEMP01"
        });

        var p1 = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Participant 1" });
        var p2 = await repo.AddParticipantAsync(new QuizParticipant { SessionId = session.Id, FullName = "Participant 2" });

        var q1 = await repo.CreateQuestionAsync(new QuizQuestion { SessionId = session.Id, QuestionNumber = 1 });
        await repo.RecordAnswerAsync(new QuizAnswer
        {
            SessionId = session.Id,
            QuestionId = q1.Id,
            ParticipantId = p1.Id,
            SelectedOption = 1,
            ResponseMilliseconds = 2500
        });

        // Verify entities exist
        Assert.Equal(2, await context.Participants.CountAsync(p => p.SessionId == session.Id));
        Assert.Equal(1, await context.Questions.CountAsync(q => q.SessionId == session.Id));
        Assert.Equal(1, await context.Answers.CountAsync(a => a.SessionId == session.Id));

        // Act: Delete Session
        var deleted = await repo.DeleteSessionAsync(session.Id);

        // Assert cascading wipe
        Assert.True(deleted);
        Assert.Null(await repo.GetSessionByIdAsync(session.Id));
        Assert.Equal(0, await context.Participants.CountAsync(p => p.SessionId == session.Id));
        Assert.Equal(0, await context.Questions.CountAsync(q => q.SessionId == session.Id));
        Assert.Equal(0, await context.Answers.CountAsync(a => a.SessionId == session.Id));
    }

    [Fact]
    public void TokenService_GeneratesValidJwt_WithAdminClaims()
    {
        // Arrange
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"Jwt:Secret", "TestSecretKeyForQuizMasterCompetitions2026VerySecure"},
            {"Jwt:Issuer", "QuizMasterTest"},
            {"Jwt:Audience", "QuizMasterClient"}
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var tokenService = new TokenService(configuration);
        var admin = new AdminUser
        {
            Id = Guid.NewGuid(),
            Username = "quizadmin",
            Role = "Admin"
        };

        // Act
        var token = tokenService.GenerateToken(admin);

        // Assert
        Assert.NotNull(token);
        Assert.NotEmpty(token);

        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);

        Assert.Contains(jwtToken.Claims, c => c.Value == "quizadmin");
        Assert.Contains(jwtToken.Claims, c => c.Type == ClaimTypes.Role && c.Value == "Admin");
    }
}

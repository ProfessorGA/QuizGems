namespace QuizMaster.Core.Enums;

public enum SessionStatus
{
    Created = 0,
    Waiting = 1,
    Voting = 2,
    VotingEnded = 3,
    AnswerReveal = 4,
    Scoring = 5,
    Completed = 6
}

export enum SessionStatus {
  Created = 'Created',
  Waiting = 'Waiting',
  Voting = 'Voting',
  VotingEnded = 'VotingEnded',
  AnswerReveal = 'AnswerReveal',
  Scoring = 'Scoring',
  Completed = 'Completed'
}

export enum QuestionStatus {
  Pending = 'Pending',
  Voting = 'Voting',
  VotingEnded = 'VotingEnded',
  Scored = 'Scored'
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  username: string;
  expiresAt: string;
}

export interface CreateSessionRequest {
  sessionName: string;
  sessionCode: string;
  totalQuestions: number;
  questionDurationSeconds: number;
  correctAnswerPoints: number;
  fastestAnswerBonus: number;
  revealResults: boolean;
}

export interface SessionDetailDto {
  id: string;
  sessionCode: string;
  sessionName: string;
  status: SessionStatus;
  totalQuestions: number;
  currentQuestionNumber: number;
  questionDurationSeconds: number;
  correctAnswerPoints: number;
  fastestAnswerBonus: number;
  revealResults: boolean;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  participantCount: number;
  activeQuestionNumber: number;
  activeQuestionStatus?: QuestionStatus;
  activeQuestionVotingEndsAt?: string;
  activeQuestionAnsweredCount?: number;
}

export interface SessionListItemDto {
  id: string;
  sessionCode: string;
  sessionName: string;
  status: SessionStatus;
  totalQuestions: number;
  currentQuestionNumber: number;
  participantCount: number;
  createdAt: string;
}

export interface JoinSessionRequest {
  sessionCode: string;
  fullName: string;
}

export interface JoinSessionResponse {
  participantId: string;
  sessionId: string;
  sessionCode: string;
  sessionName: string;
  fullName: string;
  sessionStatus: SessionStatus;
  currentQuestionNumber: number;
  totalQuestions: number;
  questionDurationSeconds: number;
}

export interface SubmitAnswerRequest {
  participantId: string;
  sessionCode: string;
  selectedOption: number;
}

export interface SubmitAnswerResponse {
  success: boolean;
  message: string;
  selectedOption: number;
  responseMilliseconds: number;
  serverReceivedAt: string;
}

export interface ParticipantStateDto {
  participantId: string;
  fullName: string;
  sessionCode: string;
  sessionName: string;
  sessionStatus: SessionStatus;
  currentQuestionNumber: number;
  totalQuestions: number;
  currentQuestionStatus?: QuestionStatus;
  votingEndsAt?: string;
  durationSeconds: number;
  hasSubmittedAnswer: boolean;
  submittedOption?: number;
  correctOption?: number;
  isCorrect?: boolean;
  isFastest: boolean;
  pointsAwarded: number;
  totalScore: number;
  rank: number;
}

export interface ParticipantHubDto {
  id: string;
  fullName: string;
  isConnected: boolean;
  totalScore: number;
  rank: number;
  hasAnsweredCurrentQuestion: boolean;
  submittedOption?: number;
  responseMilliseconds?: number;
}

export interface SessionStateHubDto {
  sessionId: string;
  sessionCode: string;
  sessionName: string;
  status: SessionStatus;
  currentQuestionNumber: number;
  totalQuestions: number;
  questionDurationSeconds: number;
  participantCount: number;
}

export interface VotingStartedHubDto {
  questionId: string;
  questionNumber: number;
  totalQuestions: number;
  durationSeconds: number;
  votingStartedAtUtc: string;
  votingEndsAtUtc: string;
}

export interface VotingEndedHubDto {
  questionNumber: number;
  totalAnswered: number;
  totalParticipants: number;
}

export interface AnswerSubmittedHubDto {
  participantId: string;
  participantName: string;
  totalAnswered: number;
  totalParticipants: number;
  responseMilliseconds: number;
}

export interface AnswerRevealedHubDto {
  questionNumber: number;
  correctOption: number;
}

export interface OptionDistributionDto {
  option1: number;
  option2: number;
  option3: number;
  option4: number;
}

export interface FastestParticipantDto {
  participantId: string;
  fullName: string;
  responseMilliseconds: number;
  responseSeconds: number;
  bonusPoints: number;
}

export interface ParticipantQuestionOutcomeDto {
  participantId: string;
  fullName: string;
  selectedOption?: number;
  isCorrect: boolean;
  isFastest: boolean;
  pointsEarned: number;
  responseMilliseconds?: number;
  responseSeconds?: number;
}

export interface QuestionResultHubDto {
  questionNumber: number;
  correctOption: number;
  totalParticipants: number;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  noAnswerCount: number;
  optionDistribution: OptionDistributionDto;
  fastestParticipant?: FastestParticipantDto;
  outcomes: ParticipantQuestionOutcomeDto[];
}

export interface ScoreboardEntryDto {
  rank: number;
  participantId: string;
  fullName: string;
  totalScore: number;
  correctAnswersCount: number;
  fastestWinsCount: number;
  totalResponseSeconds?: number;
  isConnected: boolean;
  status?: string;
}

export interface FastestResponseHighlightDto {
  questionNumber: number;
  participantName: string;
  responseSeconds: number;
  pointsAwarded: number;
}

export interface FinalScoreboardDto {
  sessionId: string;
  sessionCode: string;
  sessionName: string;
  totalQuestions: number;
  totalParticipants: number;
  totalAnswersSubmitted: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  totalNoAnswers: number;
  leaderboard: ScoreboardEntryDto[];
  fastestResponses: FastestResponseHighlightDto[];
}

export interface NextQuestionHubDto {
  questionNumber: number;
  totalQuestions: number;
}

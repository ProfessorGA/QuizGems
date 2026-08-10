import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  JoinSessionResponse,
  ParticipantStateDto,
  SessionStateHubDto,
  VotingStartedHubDto,
  VotingEndedHubDto,
  QuestionResultHubDto,
  ScoreboardEntryDto,
  ParticipantHubDto,
  FinalScoreboardDto,
  SessionStatus
} from '../models/quiz.models';
import { QuizSignalRService } from './quiz-signalr.service';
import { SoundService } from './sound.service';

@Injectable({
  providedIn: 'root'
})
export class QuizStateService {
  // Participant State
  public participant = signal<JoinSessionResponse | null>(null);
  public sessionCode = signal<string>('');
  public participantName = signal<string>('');

  // Live Competition State
  public sessionStatus = signal<SessionStatus>(SessionStatus.Created);
  public currentQuestionNumber = signal<number>(1);
  public totalQuestions = signal<number>(25);
  public isVotingOpen = signal<boolean>(false);
  public votingEndsAt = signal<Date | null>(null);
  public remainingSeconds = signal<number>(0);
  public durationSeconds = signal<number>(15);

  // Voting Selection State
  public hasSubmitted = signal<boolean>(false);
  public selectedOption = signal<number | null>(null);
  public submissionTimeMs = signal<number | null>(null);

  // Results State
  public revealedCorrectOption = signal<number | null>(null);
  public latestResult = signal<QuestionResultHubDto | null>(null);
  public myOutcome = signal<{ isCorrect: boolean; isFastest: boolean; pointsEarned: number } | null>(null);
  public totalScore = signal<number>(0);
  public myRank = signal<number>(1);

  // Admin / Leaderboard Lists
  public liveScoreboard = signal<ScoreboardEntryDto[]>([]);
  public liveParticipants = signal<ParticipantHubDto[]>([]);
  public finalScoreboard = signal<FinalScoreboardDto | null>(null);

  private timerInterval: any = null;

  constructor(
    private signalR: QuizSignalRService,
    private sound: SoundService,
    private router: Router
  ) {
    this.restoreSessionFromStorage();
    this.subscribeToRealtimeEvents();
  }

  private restoreSessionFromStorage(): void {
    const saved = localStorage.getItem('qm_participant');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as JoinSessionResponse;
        this.participant.set(parsed);
        this.sessionCode.set(parsed.sessionCode);
        this.participantName.set(parsed.fullName);
        this.currentQuestionNumber.set(parsed.currentQuestionNumber || 1);
        this.totalQuestions.set(parsed.totalQuestions || 25);
        this.durationSeconds.set(parsed.questionDurationSeconds || 15);
      } catch {}
    }
  }

  public setParticipantSession(data: JoinSessionResponse): void {
    this.participant.set(data);
    this.sessionCode.set(data.sessionCode);
    this.participantName.set(data.fullName);
    this.currentQuestionNumber.set(data.currentQuestionNumber || 1);
    this.totalQuestions.set(data.totalQuestions || 25);
    this.durationSeconds.set(data.questionDurationSeconds || 15);
    localStorage.setItem('qm_participant', JSON.stringify(data));
  }

  public clearParticipantSession(): void {
    this.participant.set(null);
    this.sessionCode.set('');
    this.participantName.set('');
    this.hasSubmitted.set(false);
    this.selectedOption.set(null);
    localStorage.removeItem('qm_participant');
    this.signalR.stopConnection();
  }

  private subscribeToRealtimeEvents(): void {
    // 1. Session Started
    this.signalR.sessionStarted$.subscribe(dto => {
      this.sessionStatus.set(dto.status);
      this.currentQuestionNumber.set(dto.currentQuestionNumber);
      this.totalQuestions.set(dto.totalQuestions);
      this.durationSeconds.set(dto.questionDurationSeconds);
    });

    // 2. Voting Started
    this.signalR.votingStarted$.subscribe(dto => {
      this.currentQuestionNumber.set(dto.questionNumber);
      this.totalQuestions.set(dto.totalQuestions);
      this.durationSeconds.set(dto.durationSeconds);
      this.isVotingOpen.set(true);
      this.hasSubmitted.set(false);
      this.selectedOption.set(null);
      this.submissionTimeMs.set(null);
      this.revealedCorrectOption.set(null);
      this.latestResult.set(null);
      this.myOutcome.set(null);

      const endsAt = new Date(dto.votingEndsAtUtc);
      this.votingEndsAt.set(endsAt);
      this.startCountdownTimer(endsAt);

      if (this.participant()) {
        this.router.navigate(['/participant/voting']);
      }
    });

    // 3. Voting Ended
    this.signalR.votingEnded$.subscribe(dto => {
      this.isVotingOpen.set(false);
      this.stopCountdownTimer();
      this.sound.playTimeUp();

      if (this.participant()) {
        if (this.hasSubmitted()) {
          this.router.navigate(['/participant/submitted']);
        } else {
          this.router.navigate(['/participant/waiting']);
        }
      }
    });

    // 4. Answer Revealed
    this.signalR.answerRevealed$.subscribe(dto => {
      this.revealedCorrectOption.set(dto.correctOption);
    });

    // 5. Question Result
    this.signalR.questionResult$.subscribe(dto => {
      this.latestResult.set(dto);

      const myId = this.participant()?.participantId;
      if (myId) {
        const myOutcomeItem = dto.outcomes.find(o => o.participantId === myId);
        if (myOutcomeItem) {
          this.myOutcome.set({
            isCorrect: myOutcomeItem.isCorrect,
            isFastest: myOutcomeItem.isFastest,
            pointsEarned: myOutcomeItem.pointsEarned
          });

          if (myOutcomeItem.isFastest) {
            this.sound.playFastestFanfare();
          } else if (myOutcomeItem.isCorrect) {
            this.sound.playCorrect();
          }
        }
        this.router.navigate(['/participant/result']);
      }
    });

    // 6. Scoreboard Updated
    this.signalR.scoreboardUpdated$.subscribe(entries => {
      this.liveScoreboard.set(entries);
      const myId = this.participant()?.participantId;
      if (myId) {
        const me = entries.find(e => e.participantId === myId);
        if (me) {
          this.totalScore.set((me as any).TotalScore ?? me.totalScore ?? 0);
          this.myRank.set((me as any).Rank ?? me.rank ?? 0);
        }
      }
    });

    // 7. Next Question
    this.signalR.nextQuestion$.subscribe(dto => {
      this.currentQuestionNumber.set(dto.questionNumber);
      this.totalQuestions.set(dto.totalQuestions);
      this.isVotingOpen.set(false);
      this.hasSubmitted.set(false);
      this.selectedOption.set(null);
      this.submissionTimeMs.set(null);
      this.revealedCorrectOption.set(null);
      this.latestResult.set(null);
      this.myOutcome.set(null);

      if (this.participant()) {
        this.router.navigate(['/participant/waiting']);
      }
    });

    // 8. Quiz Completed
    this.signalR.quizCompleted$.subscribe(dto => {
      this.finalScoreboard.set(dto);
      this.sessionStatus.set(SessionStatus.Completed);
      this.sound.playFastestFanfare();
      if (this.participant()) {
        this.router.navigate(['/participant/result']);
      }
    });

    // 9. Participant Monitoring (Admin)
    this.signalR.participantJoined$.subscribe(p => {
      const current = this.liveParticipants();
      const existingIdx = current.findIndex(x => x.id === p.id);
      if (existingIdx >= 0) {
        const updated = [...current];
        updated[existingIdx] = p;
        this.liveParticipants.set(updated);
      } else {
        this.liveParticipants.set([...current, p]);
      }
    });

    this.signalR.participantDisconnected$.subscribe(({ participantId }) => {
      const current = this.liveParticipants();
      this.liveParticipants.set(
        current.map(p => p.id === participantId ? { ...p, isConnected: false } : p)
      );
    });

    this.signalR.participantReconnected$.subscribe(({ participantId }) => {
      const current = this.liveParticipants();
      this.liveParticipants.set(
        current.map(p => p.id === participantId ? { ...p, isConnected: true } : p)
      );
    });

    this.signalR.answerSubmitted$.subscribe(dto => {
      const current = this.liveParticipants();
      this.liveParticipants.set(
        current.map(p => p.id === dto.participantId ? { ...p, hasAnsweredCurrentQuestion: true } : p)
      );
    });

    this.signalR.sessionDeleted$.subscribe(() => {
      this.clearParticipantSession();
      this.router.navigate(['/join'], { queryParams: { deleted: true } });
    });
  }

  private startCountdownTimer(endsAt: Date): void {
    this.stopCountdownTimer();
    const update = () => {
      const now = new Date().getTime();
      const diffMs = endsAt.getTime() - now;
      const seconds = Math.max(0, Math.ceil(diffMs / 1000));
      this.remainingSeconds.set(seconds);

      if (seconds <= 5 && seconds > 0) {
        this.sound.playTick();
      }

      if (diffMs <= 0) {
        this.stopCountdownTimer();
      }
    };

    update();
    this.timerInterval = setInterval(update, 250);
  }

  private stopCountdownTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public markAnswerSubmitted(option: number, responseMs: number): void {
    this.hasSubmitted.set(true);
    this.selectedOption.set(option);
    this.submissionTimeMs.set(responseMs);
    this.sound.playSubmit();
  }
}

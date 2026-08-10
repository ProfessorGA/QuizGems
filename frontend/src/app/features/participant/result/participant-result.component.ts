import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-participant-result',
  standalone: true,
  imports: [CommonModule, RouterModule, ConnectionBadgeComponent],
  template: `
    <div class="result-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="result-card glass-card p-4 p-sm-5 text-center w-100" style="max-width: 480px;">
        
        <!-- ========================================== -->
        <!-- SCENARIO A: GRAND FINALE / QUIZ COMPLETED  -->
        <!-- ========================================== -->
        <div *ngIf="state.sessionStatus() === 'Completed'" class="finale-section animate-fade-in">
          
          <!-- Victory Trophy / Medal Icon -->
          <div class="finale-badge mx-auto mb-3" [ngClass]="getFinaleBadgeClass()">
            <span *ngIf="state.myRank() === 1" class="badge-emoji trophy-animated">🏆</span>
            <span *ngIf="state.myRank() === 2" class="badge-emoji">🥈</span>
            <span *ngIf="state.myRank() === 3" class="badge-emoji">🥉</span>
            <span *ngIf="state.myRank() > 3" class="badge-emoji">⭐</span>
          </div>

          <!-- Shining Victory Titles -->
          <h1 class="h2 fw-bolder mb-1" [ngClass]="getFinaleTitleClass()">
            {{ getFinaleTitle() }}
          </h1>
          <p class="finale-subtitle mb-4">
            {{ getFinaleSubtitle() }}
          </p>

          <!-- Grand Summary Grid -->
          <div class="score-summary-grid row g-2 mb-4">
            
            <div class="col-4">
              <div class="score-card p-3 rounded-3" [class.gold-border]="state.myRank() === 1">
                <span class="score-label">FINAL RANK</span>
                <div class="score-value" [ngClass]="getRankColorClass()">
                  #{{ state.myRank() || 1 }}
                </div>
              </div>
            </div>

            <div class="col-4">
              <div class="score-card p-3 rounded-3" [class.gold-border]="state.myRank() === 1">
                <span class="score-label">TOTAL SCORE</span>
                <div class="score-value text-indigo">
                  {{ state.totalScore() }}
                </div>
              </div>
            </div>

            <div class="col-4">
              <div class="score-card p-3 rounded-3" [class.gold-border]="state.myRank() === 1">
                <span class="score-label">QUESTIONS</span>
                <div class="score-value text-success">
                  {{ state.totalQuestions() }}
                </div>
              </div>
            </div>

          </div>

          <div class="finale-congrats-card p-3 rounded-4 mb-4 text-center">
            <span class="d-block fs-3 mb-1">🎉</span>
            <h2 class="h5 fw-bold text-white mb-1">Official Tournament Complete</h2>
            <p class="small text-secondary mb-0">
              Outstanding performance in the physical arena, <strong>{{ state.participantName() }}</strong>! The host will present the awards shortly.
            </p>
          </div>

        </div>

        <!-- ========================================== -->
        <!-- SCENARIO B: LIVE QUESTION-BY-QUESTION VIEW  -->
        <!-- ========================================== -->
        <div *ngIf="state.sessionStatus() !== 'Completed'" class="question-result-section animate-fade-in">
          
          <!-- Question Outcome Icon -->
          <div class="outcome-icon mx-auto mb-3" [ngClass]="outcomeClass">
            <i class="bi" [ngClass]="outcomeIcon"></i>
          </div>

          <h1 class="h3 fw-bold text-white mb-1">{{ outcomeTitle }}</h1>
          <p class="small mb-4" [ngClass]="outcomeSubtitleClass">{{ outcomeSubtitle }}</p>

          <!-- Correct Option Card -->
          <div class="correct-option-box p-3 rounded-4 mb-4">
            <span class="text-secondary small fw-bold text-uppercase d-block mb-1">CORRECT ANSWER</span>
            <h2 class="correct-option-text mb-0">
              OPTION {{ state.revealedCorrectOption() || state.latestResult()?.correctOption }}
            </h2>
          </div>

          <!-- Live Score, Time, and Current Rank -->
          <div class="score-summary-grid row g-2 mb-4">
            
            <div class="col-4">
              <div class="score-card p-3 rounded-3">
                <span class="score-label">POINTS EARNED</span>
                <div class="score-value text-success">+{{ state.myOutcome()?.pointsEarned || 0 }}</div>
              </div>
            </div>

            <div class="col-4">
              <div class="score-card p-3 rounded-3">
                <span class="score-label">TOTAL SCORE</span>
                <div class="score-value text-indigo">{{ state.totalScore() }}</div>
              </div>
            </div>

            <div class="col-4">
              <div class="score-card p-3 rounded-3">
                <span class="score-label">LIVE RANK</span>
                <div class="score-value text-warning">#{{ state.myRank() || '-' }}</div>
              </div>
            </div>

          </div>

          <!-- Response Speed Pill if Contestant Submitted -->
          <div *ngIf="state.submissionTimeMs()" class="speed-pill mb-4 p-2 rounded-3 text-center">
            <span class="text-secondary small me-2">Your Locked Response Time:</span>
            <strong class="text-info">{{ (state.submissionTimeMs()! / 1000).toFixed(3) }}s</strong>
          </div>

          <!-- Fastest Participant Spotlight if won by someone else -->
          <div *ngIf="state.latestResult()?.fastestParticipant as fastest" class="fastest-box p-3 rounded-3 mb-4 text-start">
            <div class="d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <span class="trophy-icon">⚡</span>
                <div>
                  <span class="fastest-title d-block">Fastest Contestant (+5 Bonus)</span>
                  <strong class="fastest-name">{{ fastest.fullName || 'Contestant' }}</strong>
                </div>
              </div>
              <div class="text-end">
                <span class="badge-time">{{ fastest.responseSeconds }}s</span>
              </div>
            </div>
          </div>

          <!-- Waiting Indicator for Next Question -->
          <div class="next-step-hint text-secondary small py-2">
            <span class="spinner-grow spinner-grow-sm me-2 text-indigo"></span>
            Waiting for the Quiz Master to start the next question...
          </div>

        </div>

        <!-- Real-Time Connection Badge -->
        <div class="d-flex align-items-center justify-content-center gap-2 pt-3 border-top border-secondary border-opacity-25 mt-3">
          <app-connection-badge></app-connection-badge>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .result-wrapper {
      background: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.2), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.15), transparent 60%),
                  #070913;
    }
    .glass-card {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 26px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6), 0 0 35px rgba(99, 102, 241, 0.15);
    }

    /* Grand Finale Styling */
    .finale-badge {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      box-shadow: 0 0 35px rgba(251, 191, 36, 0.6);
    }
    .badge-gold {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border: 3px solid #fde68a;
    }
    .badge-silver {
      background: linear-gradient(135deg, #94a3b8, #64748b);
      border: 3px solid #e2e8f0;
      box-shadow: 0 0 30px rgba(226, 232, 240, 0.5);
    }
    .badge-bronze {
      background: linear-gradient(135deg, #b45309, #78350f);
      border: 3px solid #fcd34d;
      box-shadow: 0 0 25px rgba(180, 83, 9, 0.5);
    }
    .badge-star {
      background: linear-gradient(135deg, #6366f1, #4338ca);
      border: 3px solid #a5b4fc;
      box-shadow: 0 0 25px rgba(99, 102, 241, 0.5);
    }
    .badge-emoji {
      font-size: 2.8rem;
    }

    .shining-gold-text {
      background: linear-gradient(90deg, #fef08a, #f59e0b, #fbbf24, #fef08a);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shine 3s linear infinite;
      letter-spacing: 0.02em;
    }
    .shining-silver-text {
      background: linear-gradient(90deg, #f8fafc, #94a3b8, #cbd5e1, #ffffff);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shine 3s linear infinite;
    }
    .shining-bronze-text {
      background: linear-gradient(90deg, #fef3c7, #d97706, #b45309, #fde68a);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shine 3s linear infinite;
    }
    .shining-star-text {
      background: linear-gradient(90deg, #c7d2fe, #818cf8, #a5b4fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    @keyframes shine {
      to { background-position: 200% center; }
    }

    .finale-subtitle {
      color: #94a3b8;
      font-size: 0.95rem;
    }
    .finale-congrats-card {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .gold-border {
      border: 1px solid rgba(245, 158, 11, 0.4) !important;
      background: rgba(245, 158, 11, 0.08) !important;
    }

    /* Standard Question Outcomes */
    .outcome-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.2rem;
      color: #ffffff;
      animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .icon-fastest {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      box-shadow: 0 0 30px rgba(245, 158, 11, 0.7);
    }
    .icon-correct {
      background: linear-gradient(135deg, #10b981, #059669);
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.7);
    }
    .icon-wrong {
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      box-shadow: 0 0 25px rgba(239, 68, 68, 0.5);
    }
    .icon-none {
      background: linear-gradient(135deg, #64748b, #475569);
      box-shadow: 0 0 20px rgba(100, 116, 139, 0.4);
    }

    .correct-option-box {
      background: rgba(16, 185, 129, 0.12);
      border: 2px solid rgba(16, 185, 129, 0.35);
    }
    .correct-option-text {
      color: #34d399;
      font-size: 1.7rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }

    .score-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .score-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #94a3b8;
      display: block;
    }
    .score-value {
      font-size: 1.5rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }
    .text-indigo { color: #818cf8; }

    .speed-pill {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid rgba(56, 189, 248, 0.25);
    }
    .fastest-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .trophy-icon { font-size: 1.4rem; }
    .fastest-title {
      font-size: 0.7rem;
      color: #fbbf24;
      font-weight: 700;
      text-transform: uppercase;
    }
    .fastest-name {
      color: #ffffff;
      font-size: 0.95rem;
    }
    .badge-time {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.8rem;
    }

    @keyframes pop-in {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ParticipantResultComponent implements OnInit {
  constructor(
    public state: QuizStateService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParams['code'] || this.state.sessionCode();
    const id = this.route.snapshot.queryParams['id'] || this.state.participant()?.participantId;

    if (code && id && !this.state.totalScore()) {
      await this.state.syncWithServerState(code, id);
    }

    const outcome = this.state.myOutcome();
    if (this.state.sessionStatus() === 'Completed' || outcome?.isFastest || outcome?.isCorrect) {
      this.triggerConfetti();
    }
  }

  private triggerConfetti(): void {
    if (typeof window !== 'undefined' && (window as any).confetti) {
      try {
        (window as any).confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    }
  }

  public getFinaleTitle(): string {
    const rank = this.state.myRank() || 1;
    if (rank === 1) return '👑 GRAND CHAMPION! 1ST PLACE!';
    if (rank === 2) return '🥈 2ND PLACE • RUNNER UP!';
    if (rank === 3) return '🥉 3RD PLACE • PODIUM FINISH!';
    return `⭐ CONGRATULATIONS • RANK #${rank}`;
  }

  public getFinaleSubtitle(): string {
    const rank = this.state.myRank() || 1;
    if (rank === 1) return 'Incredible victory! You took the #1 crown in the live competition!';
    if (rank === 2) return 'Phenomenal run! You earned 2nd place on the championship podium!';
    if (rank === 3) return 'Great performance! You secured a top 3 medal finish!';
    return 'Fantastic effort throughout the competition! Thank you for participating.';
  }

  public getFinaleBadgeClass(): string {
    const rank = this.state.myRank() || 1;
    if (rank === 1) return 'badge-gold';
    if (rank === 2) return 'badge-silver';
    if (rank === 3) return 'badge-bronze';
    return 'badge-star';
  }

  public getFinaleTitleClass(): string {
    const rank = this.state.myRank() || 1;
    if (rank === 1) return 'shining-gold-text';
    if (rank === 2) return 'shining-silver-text';
    if (rank === 3) return 'shining-bronze-text';
    return 'shining-star-text';
  }

  public getRankColorClass(): string {
    const rank = this.state.myRank() || 1;
    if (rank === 1) return 'text-warning';
    if (rank === 2) return 'text-light';
    if (rank === 3) return 'text-amber-500';
    return 'text-info';
  }

  get outcomeClass(): string {
    const o = this.state.myOutcome();
    if (!o) return 'icon-none';
    if (o.isFastest) return 'icon-fastest';
    if (o.isCorrect) return 'icon-correct';
    return 'icon-wrong';
  }

  get outcomeIcon(): string {
    const o = this.state.myOutcome();
    if (!o) return 'bi-hourglass-split';
    if (o.isFastest) return 'bi-trophy-fill';
    if (o.isCorrect) return 'bi-check-lg';
    return 'bi-x-lg';
  }

  get outcomeTitle(): string {
    const o = this.state.myOutcome();
    if (!o) return 'TIME EXPIRED';
    if (o.isFastest) return '🏆 FASTEST ANSWER!';
    if (o.isCorrect) return '✓ CORRECT ANSWER!';
    return '✗ INCORRECT';
  }

  get outcomeSubtitle(): string {
    const o = this.state.myOutcome();
    if (!o) return 'No answer was locked in before the time limit expired.';
    if (o.isFastest) return 'Lightning fast! You claimed the fastest-finger bonus.';
    if (o.isCorrect) return 'Great job! You earned the correct answer points.';
    return 'Stay focused! You can gain points back on the next question.';
  }

  get outcomeSubtitleClass(): string {
    const o = this.state.myOutcome();
    if (!o) return 'text-secondary';
    if (o.isCorrect) return 'text-success';
    return 'text-danger';
  }
}

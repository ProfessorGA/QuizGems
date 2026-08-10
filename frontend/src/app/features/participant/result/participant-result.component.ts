import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';

import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-participant-result',
  standalone: true,
  imports: [CommonModule, RouterModule, ConnectionBadgeComponent],
  template: `
    <div class="result-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="result-card glass-card p-4 p-sm-5 text-center w-100" style="max-width: 460px;">
        
        <!-- Header: Question Outcome -->
        <div class="outcome-icon mx-auto mb-3" [ngClass]="outcomeClass">
          <i class="bi" [ngClass]="outcomeIcon"></i>
        </div>

        <h1 class="h3 fw-bold text-white mb-1">{{ outcomeTitle }}</h1>
        <p class="small mb-4" [ngClass]="outcomeSubtitleClass">{{ outcomeSubtitle }}</p>

        <!-- Correct Option Card -->
        <div class="correct-option-box p-3 rounded-4 mb-4">
          <span class="text-secondary small fw-bold text-uppercase d-block mb-1">CORRECT ANSWER</span>
          <h2 class="correct-option-text mb-0">OPTION {{ state.revealedCorrectOption() || state.latestResult()?.correctOption }}</h2>
        </div>

        <!-- Participant Score Card (Live Personal Score & Rank) -->
        <div class="score-summary-grid row g-2 mb-4">
          
          <div class="col-4">
            <div class="score-card p-3 rounded-3">
              <span class="score-label">POINTS EARNED</span>
              <div class="score-value text-success">+{{ state.myOutcome()?.pointsEarned || 0 }}</div>
            </div>
          </div>

          <div class="col-4">
            <div class="score-card p-3 rounded-3">
              <span class="score-label">MY TOTAL SCORE</span>
              <div class="score-value text-indigo">{{ state.totalScore() }}</div>
            </div>
          </div>

          <div class="col-4">
            <div class="score-card p-3 rounded-3">
              <span class="score-label">CURRENT RANK</span>
              <div class="score-value text-warning">#{{ state.myRank() || '-' }}</div>
            </div>
          </div>

        </div>

        <!-- Final Quiz Completed Banner -->
        <div *ngIf="state.sessionStatus() === 'Completed'" class="completed-hero-box p-3 rounded-4 mb-4 text-center">
          <span class="d-block fs-1 mb-1">🎉</span>
          <h3 class="h5 fw-bold text-white mb-1">QUIZ COMPLETED!</h3>
          <p class="small text-secondary mb-0">
            You finished at <strong class="text-warning">Rank #{{ state.myRank() || 1 }}</strong> with <strong class="text-indigo">{{ state.totalScore() }} points</strong>!
          </p>
        </div>

        <!-- Fastest Participant Spotlight if won by someone else -->
        <div *ngIf="state.latestResult()?.fastestParticipant as fastest" class="fastest-box p-3 rounded-3 mb-4 text-start">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <span class="trophy-icon">⚡</span>
              <div>
                <span class="fastest-title d-block">Fastest Contestant</span>
                <strong class="fastest-name">{{ fastest.fullName || 'Winner' }}</strong>
              </div>
            </div>
            <div class="text-end">
              <span class="badge-time">{{ fastest.responseSeconds }}s</span>
            </div>
          </div>
        </div>

        <!-- Waiting for next question message -->
        <div *ngIf="state.sessionStatus() !== 'Completed'" class="next-step-hint text-secondary small py-2">
          <span class="spinner-grow spinner-grow-sm me-1 text-indigo"></span>
          Waiting for the Quiz Master to start the next question...
        </div>

        <div class="d-flex align-items-center justify-content-center gap-2 pt-3 border-top border-secondary border-opacity-25 mt-3">
          <app-connection-badge></app-connection-badge>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .result-wrapper {
      background: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.18), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.12), transparent 60%),
                  #0b0f19;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.9);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.15);
    }
    .outcome-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.4rem;
      animation: pop-bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .icon-fastest {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff;
      box-shadow: 0 0 25px rgba(245, 158, 11, 0.7);
    }
    .icon-correct {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.7);
    }
    .icon-wrong {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: #ffffff;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
    }
    .icon-none {
      background: linear-gradient(135deg, #64748b, #475569);
      color: #ffffff;
      box-shadow: 0 0 15px rgba(100, 116, 139, 0.4);
    }

    .correct-option-box {
      background: rgba(16, 185, 129, 0.12);
      border: 1.5px solid rgba(16, 185, 129, 0.4);
    }
    .correct-option-text {
      font-size: 1.6rem;
      font-weight: 800;
      color: #34d399;
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
    .text-indigo {
      color: #818cf8;
    }

    .fastest-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .trophy-icon {
      font-size: 1.4rem;
    }
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

    @keyframes pop-bounce {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.15); }
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
    if (outcome?.isFastest || outcome?.isCorrect) {
      this.triggerConfetti();
    }
  }

  private triggerConfetti(): void {
    if (typeof window !== 'undefined' && (window as any).confetti) {
      try {
        (window as any).confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {}
    }
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
    if (!o) return 'No answer was submitted within the 15-second time limit.';
    if (o.isFastest) return 'Lightning fast! You earned the fastest response bonus.';
    if (o.isCorrect) return 'Great job! You answered correctly.';
    return 'Better luck on the next question.';
  }

  get outcomeSubtitleClass(): string {
    const o = this.state.myOutcome();
    if (!o) return 'text-secondary';
    if (o.isCorrect) return 'text-success';
    return 'text-danger';
  }
}

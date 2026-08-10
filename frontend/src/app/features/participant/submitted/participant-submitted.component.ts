import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-participant-submitted',
  standalone: true,
  imports: [CommonModule, ConnectionBadgeComponent],
  template: `
    <div class="submitted-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="submitted-card glass-card p-4 p-sm-5 text-center w-100" style="max-width: 440px;">
        
        <!-- Animated Success Badge -->
        <div class="success-orb mx-auto mb-4">
          <i class="bi bi-check2-circle"></i>
        </div>

        <h1 class="h3 fw-bold text-white mb-1">ANSWER SUBMITTED</h1>
        <p class="text-secondary small mb-4">Your selection has been locked in.</p>

        <!-- Selected Option Pill -->
        <div class="selected-pill mb-4" [ngClass]="'opt-border-' + state.selectedOption()">
          <span class="pill-label">YOUR CHOICE</span>
          <h2 class="pill-option mb-0">OPTION {{ state.selectedOption() || '-' }}</h2>
          <span *ngIf="state.submissionTimeMs()" class="pill-time">
            Response Time: {{ (state.submissionTimeMs()! / 1000).toFixed(3) }}s
          </span>
        </div>

        <!-- Waiting Indicator -->
        <div class="waiting-box p-3 rounded-4 mb-4">
          <div class="d-flex align-items-center justify-content-center gap-2 text-indigo mb-1">
            <span class="spinner-grow spinner-grow-sm"></span>
            <span class="fw-bold small">Waiting for Quiz Master to reveal result...</span>
          </div>
          <p class="text-secondary small mb-0">
            Scores and fastest contestant will be determined once Admin confirms the correct answer.
          </p>
        </div>

        <!-- Connection -->
        <div class="d-flex align-items-center justify-content-center gap-2 pt-3 border-top border-secondary border-opacity-25">
          <app-connection-badge></app-connection-badge>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .submitted-wrapper {
      background: radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.15), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.1), transparent 60%),
                  #0b0f19;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.15);
    }
    .success-orb {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.2rem;
      color: #ffffff;
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
      animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .selected-pill {
      background: rgba(30, 41, 59, 0.7);
      border: 2px solid rgba(99, 102, 241, 0.5);
      border-radius: 16px;
      padding: 16px;
    }
    .pill-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .pill-option {
      font-size: 1.6rem;
      font-weight: 800;
      color: #ffffff;
    }
    .pill-time {
      display: block;
      font-size: 0.8rem;
      color: #38bdf8;
      font-weight: 600;
      margin-top: 4px;
    }
    .opt-border-1 { border-color: #ef4444 !important; }
    .opt-border-2 { border-color: #3b82f6 !important; }
    .opt-border-3 { border-color: #eab308 !important; }
    .opt-border-4 { border-color: #10b981 !important; }
    .waiting-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px dashed rgba(99, 102, 241, 0.3);
    }
    .text-indigo { color: #818cf8; }
    @keyframes pop-in {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ParticipantSubmittedComponent implements OnInit {
  constructor(
    public state: QuizStateService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParams['code'] || this.state.sessionCode();
    const id = this.route.snapshot.queryParams['id'] || this.state.participant()?.participantId;

    if (code && id && !this.state.selectedOption()) {
      await this.state.syncWithServerState(code, id);
    }
  }
}

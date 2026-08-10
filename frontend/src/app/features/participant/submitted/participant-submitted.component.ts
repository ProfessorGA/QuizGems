import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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
          <h2 class="pill-option mb-0">OPTION {{ state.selectedOption() }}</h2>
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
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.2rem;
      color: #ffffff;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.6);
      animation: pop-bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .selected-pill {
      background: rgba(15, 23, 42, 0.8);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .pill-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .pill-option {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      font-family: 'Outfit', sans-serif;
    }
    .pill-time {
      font-size: 0.75rem;
      font-weight: 600;
      color: #34d399;
    }
    .opt-border-1 { border: 2px solid rgba(99, 102, 241, 0.6); }
    .opt-border-2 { border: 2px solid rgba(16, 185, 129, 0.6); }
    .opt-border-3 { border: 2px solid rgba(245, 158, 11, 0.6); }
    .opt-border-4 { border: 2px solid rgba(244, 63, 94, 0.6); }

    .waiting-box {
      background: rgba(99, 102, 241, 0.08);
      border: 1px dashed rgba(99, 102, 241, 0.3);
    }
    .text-indigo {
      color: #a5b4fc;
    }

    @keyframes pop-bounce {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ParticipantSubmittedComponent {
  constructor(public state: QuizStateService) {}
}

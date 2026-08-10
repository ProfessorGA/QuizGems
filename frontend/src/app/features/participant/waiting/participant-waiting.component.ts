import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-participant-waiting',
  standalone: true,
  imports: [CommonModule, RouterModule, ConnectionBadgeComponent],
  template: `
    <div class="waiting-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="waiting-card glass-card p-4 p-sm-5 text-center w-100" style="max-width: 440px;">
        
        <!-- Live Pill -->
        <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill live-pill mb-4">
          <span class="live-dot"></span>
          <span class="live-text fw-bold">QUIZ LIVE</span>
        </div>

        <!-- Greeting -->
        <h1 class="h3 fw-bold text-white mb-2">
          Welcome, <span class="text-gradient">{{ state.participantName() || 'Contestant' }}</span>
        </h1>

        <!-- Session & Question Info -->
        <div class="session-badge mb-4">
          <span class="text-muted small">Session: </span>
          <span class="fw-bold text-light">{{ state.sessionCode() }}</span>
        </div>

        <!-- Radar Pulse Animation -->
        <div class="pulse-container my-4">
          <div class="radar-pulse"></div>
          <div class="radar-pulse-2"></div>
          <div class="center-mic">
            <i class="bi bi-mic-fill"></i>
          </div>
        </div>

        <!-- Status text -->
        <h2 class="h5 fw-bold text-light mb-2">Waiting for next question...</h2>
        <p class="text-secondary small mb-4">
          Listen carefully to the Quiz Master in the room. The options will activate automatically when voting begins.
        </p>

        <!-- Connection status -->
        <div class="d-flex align-items-center justify-content-center gap-2 pt-3 border-top border-secondary border-opacity-25">
          <app-connection-badge></app-connection-badge>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .waiting-wrapper {
      background: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.18), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1), transparent 60%),
                  #0b0f19;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.15);
    }
    .live-pill {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 8px #ef4444;
      animation: pulse-live 1.5s infinite;
    }
    .text-gradient {
      background: linear-gradient(90deg, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .pulse-container {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .radar-pulse, .radar-pulse-2 {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid rgba(99, 102, 241, 0.4);
      animation: radar-expand 2.5s infinite ease-out;
    }
    .radar-pulse-2 {
      animation-delay: 1.25s;
    }
    .center-mic {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      color: #ffffff;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.6);
      z-index: 2;
    }
    @keyframes radar-expand {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    @keyframes pulse-live {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
  `]
})
export class ParticipantWaitingComponent implements OnInit {
  constructor(
    public state: QuizStateService,
    private signalR: QuizSignalRService
  ) {}

  async ngOnInit(): Promise<void> {
    const p = this.state.participant();
    if (p) {
      try {
        await this.signalR.startConnection(p.sessionCode, p.participantId, false);
      } catch (err) {
        console.error('SignalR start error in waiting:', err);
      }
    }
  }
}

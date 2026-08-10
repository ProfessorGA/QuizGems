import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timer-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timer-container" [ngClass]="urgencyClass">
      <svg class="timer-svg" viewBox="0 0 100 100">
        <circle class="timer-track" cx="50" cy="50" r="44"></circle>
        <circle 
          class="timer-progress" 
          cx="50" 
          cy="50" 
          r="44"
          [style.strokeDashoffset]="strokeOffset"
        ></circle>
      </svg>
      <div class="timer-content">
        <span class="timer-seconds">{{ formattedSeconds }}</span>
        <span class="timer-label">SECONDS</span>
      </div>
    </div>
  `,
  styles: [`
    .timer-container {
      position: relative;
      width: 140px;
      height: 140px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .timer-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .timer-track {
      fill: none;
      stroke: rgba(255, 255, 255, 0.08);
      stroke-width: 7;
    }
    .timer-progress {
      fill: none;
      stroke-width: 7;
      stroke-linecap: round;
      stroke-dasharray: 276.46;
      transition: stroke-dashoffset 0.25s linear, stroke 0.3s ease;
    }
    .timer-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .timer-seconds {
      font-size: 2.2rem;
      font-weight: 800;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .timer-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      opacity: 0.6;
      margin-top: 4px;
    }

    /* Urgency Colors */
    .normal .timer-progress {
      stroke: #10b981;
      filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.5));
    }
    .normal .timer-seconds {
      color: #10b981;
    }

    .warning .timer-progress {
      stroke: #f59e0b;
      filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
    }
    .warning .timer-seconds {
      color: #f59e0b;
    }

    .critical .timer-progress {
      stroke: #ef4444;
      filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8));
    }
    .critical .timer-seconds {
      color: #ef4444;
      animation: pulse-urgent 0.5s infinite alternate;
    }

    @keyframes pulse-urgent {
      from { transform: scale(1); }
      to { transform: scale(1.08); }
    }
  `]
})
export class TimerDisplayComponent {
  @Input() remainingSeconds: number = 0;
  @Input() totalDuration: number = 15;

  get formattedSeconds(): string {
    const s = Math.max(0, this.remainingSeconds);
    return s < 10 ? `0${s}` : `${s}`;
  }

  get strokeOffset(): number {
    const total = this.totalDuration > 0 ? this.totalDuration : 15;
    const fraction = Math.max(0, Math.min(1, this.remainingSeconds / total));
    const circumference = 276.46; // 2 * pi * 44
    return circumference - (fraction * circumference);
  }

  get urgencyClass(): string {
    if (this.remainingSeconds <= 4) return 'critical';
    if (this.remainingSeconds <= 8) return 'warning';
    return 'normal';
  }
}

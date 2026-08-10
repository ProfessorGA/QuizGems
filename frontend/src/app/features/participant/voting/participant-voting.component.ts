import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';
import { ParticipantApiService } from '../../../core/services/participant-api.service';
import { TimerDisplayComponent } from '../../../shared/components/timer-display/timer-display.component';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-participant-voting',
  standalone: true,
  imports: [CommonModule, TimerDisplayComponent, ConnectionBadgeComponent],
  template: `
    <div 
      class="voting-wrapper d-flex flex-column justify-content-between min-vh-100 px-3 py-3 py-sm-4"
      [class.screen-urgent-pulse]="state.remainingSeconds() <= 5 && state.remainingSeconds() > 0"
    >
      
      <!-- Top Bar: Question # and Connection -->
      <div class="d-flex align-items-center justify-content-between w-100 max-container mx-auto">
        <div class="question-header">
          <span class="text-secondary small fw-bold text-uppercase">QUESTION</span>
          <h1 class="question-number mb-0">{{ formattedQuestionNumber }}</h1>
        </div>
        <div>
          <app-connection-badge></app-connection-badge>
        </div>
      </div>

      <!-- Center: Radial Countdown Timer -->
      <div class="timer-section my-auto py-2 text-center">
        <app-timer-display 
          [remainingSeconds]="state.remainingSeconds()" 
          [totalDuration]="state.durationSeconds()"
        ></app-timer-display>

        <!-- Instruction reminder -->
        <p class="listen-hint text-secondary small mt-2 mb-0">
          <i class="bi bi-volume-up-fill text-indigo me-1"></i>
          Select the option spoken by the Quiz Master
        </p>
      </div>

      <!-- Bottom: Four Massive Option Buttons -->
      <div class="options-grid w-100 max-container mx-auto">
        
        <div class="row g-3">
          <div class="col-6" *ngFor="let opt of [1, 2, 3, 4]">
            <button 
              type="button" 
              class="btn-option w-100"
              [ngClass]="'option-' + opt"
              [class.selected]="selectedOption() === opt"
              [disabled]="isSubmitting() || state.hasSubmitted() || state.remainingSeconds() === 0"
              (click)="onSelectOption(opt)"
            >
              <div class="opt-badge">{{ opt }}</div>
              <span class="opt-label">OPTION {{ opt }}</span>
              
              <!-- Selected Checkmark -->
              <span *ngIf="selectedOption() === opt" class="opt-check">
                <i class="bi bi-check-circle-fill"></i>
              </span>
            </button>
          </div>
        </div>

      </div>

    </div>
  `,
  styles: [`
    .voting-wrapper {
      background: radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.18), transparent 60%),
                  radial-gradient(circle at 50% 80%, rgba(139, 92, 246, 0.12), transparent 60%),
                  #070913;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: box-shadow 0.3s ease;
    }
    .max-container {
      max-width: 480px;
    }
    .question-number {
      font-size: 1.8rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(90deg, #ffffff, #c7d2fe);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    .listen-hint {
      font-size: 0.8rem;
      letter-spacing: 0.02em;
    }
    .text-indigo {
      color: #818cf8;
    }

    /* Tactile High-Contrast Neon Option Buttons */
    .btn-option {
      position: relative;
      height: 112px;
      border-radius: 22px;
      border: 2px solid transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .btn-option:hover:not(:disabled) {
      transform: translateY(-3px) scale(1.02);
    }
    .btn-option:active:not(:disabled) {
      transform: scale(0.95);
    }
    .btn-option:disabled {
      cursor: not-allowed;
      opacity: 0.75;
    }

    .opt-badge {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 1.15rem;
      font-family: 'Outfit', sans-serif;
    }
    .opt-label {
      font-weight: 800;
      font-size: 1.05rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-family: 'Outfit', sans-serif;
    }

    /* Option 1: Crimson Red */
    .option-1 {
      background: linear-gradient(145deg, #1e1014, #2a111a);
      border-color: rgba(244, 63, 94, 0.4);
      color: #fda4af;
    }
    .option-1:hover:not(:disabled) {
      border-color: #f43f5e;
      box-shadow: 0 0 25px rgba(244, 63, 94, 0.5);
    }
    .option-1 .opt-badge { background: #f43f5e; color: #fff; box-shadow: 0 0 12px rgba(244, 63, 94, 0.6); }

    /* Option 2: Electric Cyan / Indigo */
    .option-2 {
      background: linear-gradient(145deg, #0e1726, #132238);
      border-color: rgba(56, 189, 248, 0.4);
      color: #7dd3fc;
    }
    .option-2:hover:not(:disabled) {
      border-color: #38bdf8;
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.5);
    }
    .option-2 .opt-badge { background: #38bdf8; color: #04101e; box-shadow: 0 0 12px rgba(56, 189, 248, 0.6); }

    /* Option 3: Amber Gold */
    .option-3 {
      background: linear-gradient(145deg, #1f1a0d, #2d2410);
      border-color: rgba(245, 158, 11, 0.4);
      color: #fde68a;
    }
    .option-3:hover:not(:disabled) {
      border-color: #f59e0b;
      box-shadow: 0 0 25px rgba(245, 158, 11, 0.5);
    }
    .option-3 .opt-badge { background: #f59e0b; color: #221200; box-shadow: 0 0 12px rgba(245, 158, 11, 0.6); }

    /* Option 4: Emerald Green */
    .option-4 {
      background: linear-gradient(145deg, #0d1e17, #102d20);
      border-color: rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
    }
    .option-4:hover:not(:disabled) {
      border-color: #10b981;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.5);
    }
    .option-4 .opt-badge { background: #10b981; color: #fff; box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); }

    .btn-option.selected {
      border-width: 3px;
      transform: scale(0.98);
      filter: brightness(1.2);
    }
    .opt-check {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 1.2rem;
    }
    .opt-check {
      position: absolute;
      top: 8px;
      right: 10px;
      font-size: 1.2rem;
      color: #ffffff;
      animation: pop-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* Option 1: Indigo */
    .option-1 {
      background: linear-gradient(145deg, rgba(79, 70, 229, 0.85), rgba(67, 56, 202, 0.95));
      border-color: rgba(129, 140, 248, 0.5);
      color: #ffffff;
    }
    .option-1 .opt-badge {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .option-1:hover:not(:disabled) {
      border-color: #818cf8;
      box-shadow: 0 10px 24px rgba(99, 102, 241, 0.5);
    }

    /* Option 2: Emerald */
    .option-2 {
      background: linear-gradient(145deg, rgba(5, 150, 105, 0.85), rgba(4, 120, 87, 0.95));
      border-color: rgba(52, 211, 153, 0.5);
      color: #ffffff;
    }
    .option-2 .opt-badge {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .option-2:hover:not(:disabled) {
      border-color: #34d399;
      box-shadow: 0 10px 24px rgba(16, 185, 129, 0.5);
    }

    /* Option 3: Amber/Orange */
    .option-3 {
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.85), rgba(180, 83, 9, 0.95));
      border-color: rgba(251, 191, 36, 0.5);
      color: #ffffff;
    }
    .option-3 .opt-badge {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .option-3:hover:not(:disabled) {
      border-color: #fbbf24;
      box-shadow: 0 10px 24px rgba(245, 158, 11, 0.5);
    }

    /* Option 4: Rose/Fuchsia */
    .option-4 {
      background: linear-gradient(145deg, rgba(225, 29, 72, 0.85), rgba(190, 18, 60, 0.95));
      border-color: rgba(251, 113, 133, 0.5);
      color: #ffffff;
    }
    .option-4 .opt-badge {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .option-4:hover:not(:disabled) {
      border-color: #fb7185;
      box-shadow: 0 10px 24px rgba(244, 63, 94, 0.5);
    }

    /* Selected state highlights */
    .btn-option.selected {
      transform: scale(1.03);
      border-width: 3px;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.4);
    }

    @keyframes pop-in {
      0% { transform: scale(0); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ParticipantVotingComponent implements OnInit {
  public isSubmitting = signal<boolean>(false);
  public selectedOption = signal<number | null>(null);

  constructor(
    public state: QuizStateService,
    private signalR: QuizSignalRService,
    private participantApi: ParticipantApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.state.hasSubmitted()) {
      this.state.navigateParticipant('submitted');
      return;
    }

    // Vibration feedback when voting opens if mobile supports it
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(100); } catch {}
    }
  }

  get formattedQuestionNumber(): string {
    const q = this.state.currentQuestionNumber();
    const total = this.state.totalQuestions();
    const qStr = q < 10 ? `0${q}` : `${q}`;
    const totalStr = total < 10 ? `0${total}` : `${total}`;
    return `${qStr} / ${totalStr}`;
  }

  public async onSelectOption(option: number): Promise<void> {
    if (this.isSubmitting() || this.state.hasSubmitted()) return;

    this.selectedOption.set(option);
    this.isSubmitting.set(true);

    // Haptic pulse on touch
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(50); } catch {}
    }

    const p = this.state.participant();
    if (!p) {
      this.router.navigate(['/join']);
      return;
    }

    try {
      // Primary: Real-time SignalR Hub invocation
      const res = await this.signalR.submitAnswer(p.sessionCode, p.participantId, option);
      if (res.success) {
        this.state.markAnswerSubmitted(option, res.responseMilliseconds);
        this.state.navigateParticipant('submitted');
      } else {
        console.warn('Submission response not successful:', res.message);
        // Fallback REST call
        this.fallbackRestSubmission(p.sessionCode, p.participantId, option);
      }
    } catch (err) {
      console.warn('SignalR submission failed, attempting REST fallback...', err);
      this.fallbackRestSubmission(p.sessionCode, p.participantId, option);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private fallbackRestSubmission(sessionCode: string, participantId: string, option: number): void {
    this.participantApi.submitAnswer({ sessionCode, participantId, selectedOption: option }).subscribe({
      next: (res) => {
        if (res.success) {
          this.state.markAnswerSubmitted(option, res.responseMilliseconds);
          this.state.navigateParticipant('submitted');
        }
      },
      error: (err) => {
        console.error('REST fallback answer submission failed:', err);
      }
    });
  }
}

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ParticipantApiService } from '../../../core/services/participant-api.service';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-participant-join',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="join-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="join-card glass-card p-4 p-sm-5 w-100" style="max-width: 440px;">
        
        <!-- Header -->
        <div class="text-center mb-4">
          <div class="icon-orb mx-auto mb-3">
            <i class="bi bi-gem"></i>
          </div>
          <h1 class="h3 fw-bold text-white mb-1">GEMS QUIZ</h1>
          <p class="text-secondary small mb-0">Live Competition Arena</p>
        </div>

        <!-- Alert messages -->
        <div *ngIf="errorMessage()" class="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-4 rounded-3 small">
          <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <div>{{ errorMessage() }}</div>
        </div>

        <div *ngIf="infoMessage()" class="alert alert-info d-flex align-items-center gap-2 py-2 px-3 mb-4 rounded-3 small">
          <i class="bi bi-info-circle-fill flex-shrink-0"></i>
          <div>{{ infoMessage() }}</div>
        </div>

        <!-- Join Form -->
        <form (ngSubmit)="onJoin()" #joinForm="ngForm" class="d-flex flex-column gap-3">
          
          <div>
            <label class="form-label text-light small fw-bold tracking-wide">ROOM CODE</label>
            <div class="input-group-custom">
              <span class="input-icon"><i class="bi bi-hash"></i></span>
              <input 
                type="text" 
                name="sessionCode" 
                [(ngModel)]="sessionCode" 
                required 
                placeholder="e.g. GK26"
                maxlength="20"
                class="form-control-custom text-uppercase text-center fw-bold fs-5"
                [disabled]="isLoading()"
                autocomplete="off"
              />
            </div>
          </div>

          <div>
            <label class="form-label text-light small fw-bold tracking-wide">CONTESTANT FULL NAME</label>
            <div class="input-group-custom">
              <span class="input-icon"><i class="bi bi-person-badge-fill"></i></span>
              <input 
                type="text" 
                name="fullName" 
                [(ngModel)]="fullName" 
                required 
                placeholder="e.g. Alex Johnson"
                maxlength="50"
                class="form-control-custom"
                [disabled]="isLoading()"
                autocomplete="name"
              />
            </div>
          </div>

          <button 
            type="submit" 
            class="btn btn-primary-gradient w-100 py-3 rounded-3 mt-2 fw-bold text-uppercase tracking-wide fs-6 d-flex align-items-center justify-content-center gap-2"
            [disabled]="isLoading() || !joinForm.form.valid"
          >
            <span *ngIf="isLoading()" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <i *ngIf="!isLoading()" class="bi bi-box-arrow-in-right"></i>
            <span>{{ isLoading() ? 'Entering Arena...' : 'ENTER LIVE QUIZ' }}</span>
          </button>

        </form>

      </div>
    </div>
  `,
  styles: [`
    .join-wrapper {
      background-color: var(--bg-primary);
    }
    .join-card {
      border: 1px solid var(--border-subtle);
    }
    .icon-orb {
      width: 60px;
      height: 60px;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 1.8rem;
      box-shadow: 0 0 25px rgba(99, 102, 241, 0.4);
    }
    .tracking-wide {
      letter-spacing: 0.08em;
    }
    .input-group-custom {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 14px;
      color: #818cf8;
      font-size: 1.1rem;
      pointer-events: none;
      z-index: 5;
    }
    .form-control-custom {
      width: 100%;
      padding: 12px 14px 12px 42px;
      background: var(--input-bg, rgba(30, 41, 59, 0.7));
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      color: var(--text-primary);
      font-family: inherit;
      transition: all 0.2s ease;
    }
    .form-control-custom:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .btn-primary-gradient {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border: none;
      color: #ffffff;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
      transition: all 0.2s ease;
    }
    .btn-primary-gradient:hover:not(:disabled) {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      box-shadow: 0 6px 25px rgba(99, 102, 241, 0.6);
      transform: translateY(-1px);
    }
    .btn-primary-gradient:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class ParticipantJoinComponent {
  public sessionCode: string = '';
  public fullName: string = '';
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string>('');
  public infoMessage = signal<string>('');

  constructor(
    private participantApi: ParticipantApiService,
    private state: QuizStateService,
    private signalR: QuizSignalRService,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.route.queryParams.subscribe(params => {
      if (params['code']) {
        this.sessionCode = params['code'].toUpperCase();
      }
      if (params['deleted']) {
        this.alertService.moderate('Session Closed', 'The previous competition was closed by the host.');
      }
      if (params['reset']) {
        this.alertService.info('Session Reset', 'The host reset the competition for a clean fresh start.');
      }
      if (params['kicked']) {
        this.alertService.emergency('Tournament Eviction Notice', params['reason'] || 'You were removed from this competition by the Quiz Master.');
      }
    });
  }

  public onJoin(): void {
    if (!this.sessionCode.trim() || !this.fullName.trim()) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const code = this.sessionCode.trim().toUpperCase();
    const name = this.fullName.trim();

    this.participantApi.join({ sessionCode: code, fullName: name }).subscribe({
      next: async (res) => {
        this.state.setParticipantSession(res);

        if (res.isReentry) {
          this.alertService.moderate('Re-entered Active Session', res.reentryMessage || `Re-connected as ${res.fullName}!`);
        }

        try {
          await this.signalR.startConnection(code, res.participantId, false);
          this.state.navigateParticipant('waiting');
        } catch (err) {
          console.error('Could not connect SignalR hub:', err);
          this.state.navigateParticipant('waiting');
        } finally {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || 'Could not join session. Please check the code and try again.';
        this.errorMessage.set(msg);
        this.alertService.moderate('Entry Error', msg);
      }
    });
  }
}

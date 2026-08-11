import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ParticipantApiService } from '../../../core/services/participant-api.service';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';

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
            <i class="bi bi-broadcast-pin"></i>
          </div>
          <h1 class="h3 fw-bold text-white mb-1">QUIZ COMPETITION</h1>
          <p class="text-secondary small mb-0">Live Physical Room Arena</p>
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
            <label class="form-label text-light small fw-bold tracking-wide">QUIZ CODE</label>
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
            <label class="form-label text-light small fw-bold tracking-wide">FULL NAME</label>
            <div class="input-group-custom">
              <span class="input-icon"><i class="bi bi-person-fill"></i></span>
              <input 
                type="text" 
                name="fullName" 
                [(ngModel)]="fullName" 
                required 
                minlength="2"
                placeholder="Enter your full name" 
                maxlength="60"
                class="form-control-custom"
                [disabled]="isLoading()"
                autocomplete="name"
              />
            </div>
          </div>

          <button 
            type="submit" 
            class="btn-primary-action w-100 py-3 mt-3 fw-bold text-uppercase tracking-wider"
            [disabled]="isLoading() || !sessionCode || !fullName"
          >
            <span *ngIf="!isLoading()">
              <i class="bi bi-box-arrow-in-right me-2"></i>JOIN QUIZ
            </span>
            <span *ngIf="isLoading()" class="d-flex align-items-center justify-content-center gap-2">
              <span class="spinner-border spinner-border-sm"></span>
              CONNECTING...
            </span>
          </button>
        </form>

        <div class="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
          <p class="text-muted small mb-0">
            <i class="bi bi-info-circle me-1"></i>
            The Quiz Master will speak the questions verbally.
          </p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .join-wrapper {
      background: radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.15), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1), transparent 60%),
                  #0b0f19;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.1);
    }
    .icon-orb {
      width: 58px;
      height: 58px;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      color: #fff;
      box-shadow: 0 0 24px rgba(99, 102, 241, 0.5);
    }
    .tracking-wide {
      letter-spacing: 0.08em;
    }
    .tracking-wider {
      letter-spacing: 0.1em;
    }
    .input-group-custom {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 14px;
      color: #94a3b8;
      font-size: 1.1rem;
      pointer-events: none;
      z-index: 2;
    }
    .form-control-custom {
      width: 100%;
      background: rgba(15, 23, 42, 0.7);
      border: 1.5px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      color: #f8fafc;
      padding: 12px 14px 12px 42px;
      font-size: 1rem;
      transition: all 0.2s ease;
    }
    .form-control-custom:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
      background: rgba(15, 23, 42, 0.9);
    }
    .btn-primary-action {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      border-radius: 12px;
      color: #ffffff;
      font-size: 1.05rem;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
      transition: all 0.25s ease;
    }
    .btn-primary-action:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(99, 102, 241, 0.5);
      background: linear-gradient(135deg, #4f46e5, #4338ca);
    }
    .btn-primary-action:disabled {
      opacity: 0.5;
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
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.route.queryParams.subscribe(params => {
      if (params['code']) {
        this.sessionCode = params['code'].toUpperCase();
      }
      if (params['deleted']) {
        this.infoMessage.set('The previous session was closed by the host.');
      }
      if (params['reset']) {
        this.infoMessage.set('The host reset the contestants. Please re-enter to join fresh.');
      }
      if (params['kicked']) {
        this.errorMessage.set(params['reason'] || 'You were removed from this competition by the Quiz Master.');
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
        this.errorMessage.set(err.error?.message || 'Could not join session. Please check the code and try again.');
      }
    });
  }
}

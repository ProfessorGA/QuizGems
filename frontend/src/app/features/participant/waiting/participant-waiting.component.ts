import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';
import { ParticipantApiService } from '../../../core/services/participant-api.service';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';

@Component({
  selector: 'app-participant-waiting',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConnectionBadgeComponent],
  template: `
    <div class="waiting-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="waiting-card glass-card p-4 p-sm-5 text-center w-100" style="max-width: 460px;">
        
        <!-- Live Pill -->
        <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill live-pill mb-4">
          <span class="live-dot"></span>
          <span class="live-text fw-bold">QUIZ LIVE</span>
        </div>

        <!-- Greeting & Name -->
        <h1 class="h3 fw-bold text-theme-primary mb-1">
          Welcome, <span class="text-gradient">{{ state.participantName() || 'Contestant' }}</span>
        </h1>

        <!-- Rename Badge & Edit Button -->
        <div class="mb-3">
          <span *ngIf="state.previousName()" class="badge bg-secondary-subtle text-secondary small d-inline-block mb-1">
            (formerly: "{{ state.previousName() }}")
          </span>
          <div *ngIf="!state.hasRenamed()">
            <button 
              class="btn btn-outline-primary btn-sm px-3 py-1 rounded-pill mt-1" 
              style="font-size: 0.75rem;"
              (click)="openRenameModal()"
            >
              <i class="bi bi-pencil-square me-1"></i>Edit Name (Allowed 1x)
            </button>
          </div>
        </div>

        <!-- Session & Question Info -->
        <div class="session-badge mb-4">
          <span class="text-muted small">Session Code: </span>
          <span class="fw-bold text-theme-primary fs-5">{{ state.sessionCode() }}</span>
        </div>

        <!-- Radar Pulse Animation & Dynamic Sound Equalizer -->
        <div class="pulse-container my-4">
          <div class="radar-pulse"></div>
          <div class="radar-pulse-2"></div>
          <div class="center-mic">
            <i class="bi bi-mic-fill"></i>
          </div>
          <div class="sound-wave-bars">
            <span class="bar bar-1"></span>
            <span class="bar bar-2"></span>
            <span class="bar bar-3"></span>
            <span class="bar bar-4"></span>
            <span class="bar bar-5"></span>
          </div>
        </div>

        <!-- Status text -->
        <h2 class="h5 fw-bold text-theme-primary mb-2">Waiting for next question...</h2>
        <p class="text-theme-secondary small mb-4">
          Listen carefully to the Quiz Master in the room. The options will activate automatically when voting begins.
        </p>

        <!-- Connection status -->
        <div class="d-flex align-items-center justify-content-center gap-2 pt-3 border-top border-secondary border-opacity-25">
          <app-connection-badge></app-connection-badge>
        </div>

      </div>
    </div>

    <!-- Rename Participant Modal -->
    <div class="modal fade show d-block" *ngIf="showRenameModal()" tabindex="-1" style="background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
      <div class="modal-dialog modal-dialog-centered" style="max-width: 400px;">
        <div class="modal-content glass-card border border-primary border-opacity-50 rounded-4 p-4 text-theme-primary">
          <div class="modal-header border-0 p-0 mb-3">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-person-badge-fill text-primary fs-4"></i>
              <h3 class="modal-title h5 fw-bold mb-0">Update Contestant Name</h3>
            </div>
          </div>
          
          <div class="modal-body p-0 mb-4">
            <p class="small text-theme-secondary mb-3">
              You can only change your name <strong>once</strong>. Your previous name will remain visible in the host log for tournament anti-fraud verification.
            </p>
            <label class="form-label small fw-bold text-theme-secondary">New Full Name</label>
            <input 
              type="text" 
              class="form-control form-control-lg rounded-3 mb-2" 
              placeholder="e.g. John Doe" 
              [(ngModel)]="newNameInput"
              [disabled]="isRenaming()"
              maxlength="40"
            />
          </div>

          <div class="modal-footer border-0 p-0 d-flex gap-2">
            <button type="button" class="btn btn-secondary flex-grow-1 py-2 rounded-3" (click)="closeRenameModal()" [disabled]="isRenaming()">
              Cancel
            </button>
            <button type="button" class="btn btn-primary flex-grow-1 py-2 rounded-3 fw-bold" (click)="onSaveRename()" [disabled]="isRenaming() || !newNameInput.trim()">
              <span *ngIf="isRenaming()" class="spinner-border spinner-border-sm me-1"></span>
              Save Name
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .waiting-wrapper {
      background: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1), transparent 60%);
    }
    .glass-card {
      border-radius: 24px;
    }
    .live-pill {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #ef4444;
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
      background: linear-gradient(90deg, #6366f1, #a855f7);
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
    .sound-wave-bars {
      position: absolute;
      bottom: -15px;
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
      height: 20px;
    }
    .bar {
      width: 3px;
      background: #818cf8;
      border-radius: 3px;
      animation: soundWave 1.2s infinite ease-in-out alternate;
    }
    .bar-1 { height: 6px; animation-delay: 0.1s; }
    .bar-2 { height: 16px; animation-delay: 0.3s; }
    .bar-3 { height: 22px; animation-delay: 0s; }
    .bar-4 { height: 14px; animation-delay: 0.4s; }
    .bar-5 { height: 8px; animation-delay: 0.2s; }

    @keyframes soundWave {
      0% { transform: scaleY(0.4); opacity: 0.5; }
      100% { transform: scaleY(1.3); opacity: 1; filter: drop-shadow(0 0 6px #818cf8); }
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
  public showRenameModal = signal<boolean>(false);
  public newNameInput = '';
  public isRenaming = signal<boolean>(false);

  constructor(
    public state: QuizStateService,
    private signalR: QuizSignalRService,
    private participantApi: ParticipantApiService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParams['code'] || this.state.sessionCode();
    const id = this.route.snapshot.queryParams['id'] || this.state.participant()?.participantId;

    if (code && id) {
      await this.state.syncWithServerState(code, id);
    } else {
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

  public openRenameModal(): void {
    this.newNameInput = this.state.participantName();
    this.showRenameModal.set(true);
  }

  public closeRenameModal(): void {
    this.showRenameModal.set(false);
  }

  public onSaveRename(): void {
    const code = this.state.sessionCode();
    const pid = this.state.participant()?.participantId;
    const newName = this.newNameInput.trim();

    if (!code || !pid || !newName) return;

    this.isRenaming.set(true);
    this.participantApi.rename({ sessionCode: code, participantId: pid, newFullName: newName }).subscribe({
      next: (res) => {
        this.isRenaming.set(false);
        this.state.participantName.set(res.fullName);
        this.state.hasRenamed.set(true);
        this.state.previousName.set(res.previousFullName || null);
        this.showRenameModal.set(false);
      },
      error: (err) => {
        this.isRenaming.set(false);
        alert(err.error?.message || 'Failed to update name.');
      }
    });
  }
}

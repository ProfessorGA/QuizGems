import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { SessionListItemDto, CreateSessionRequest, SessionStatus } from '../../../core/models/quiz.models';

@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="sessions-wrapper py-4 px-3 px-md-5 min-vh-100">
      <div class="container-xl">
        
        <!-- Header -->
        <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-indigo-subtle text-indigo px-3 py-1 rounded-pill fw-bold">Admin Console</span>
              <span class="text-secondary small">Live Competitions</span>
            </div>
            <h1 class="h2 fw-bold text-white mb-0">Quiz Sessions</h1>
          </div>

          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-light rounded-3 px-3 py-2" (click)="loadSessions()" [disabled]="isLoading()">
              <i class="bi bi-arrow-clockwise" [class.spin]="isLoading()"></i>
              <span class="ms-1 d-none d-sm-inline">Refresh</span>
            </button>
            <button class="btn btn-primary-gradient rounded-3 px-4 py-2 fw-bold d-flex align-items-center gap-2" (click)="openCreateModal()">
              <i class="bi bi-plus-circle-fill"></i>
              <span>Create Session</span>
            </button>
          </div>
        </div>

        <!-- Alert messages -->
        <div *ngIf="successMessage()" class="alert alert-success d-flex align-items-center justify-content-between py-2 px-3 mb-4 rounded-3 small">
          <div><i class="bi bi-check-circle-fill me-2"></i>{{ successMessage() }}</div>
          <button type="button" class="btn-close btn-close-white" (click)="successMessage.set('')"></button>
        </div>

        <div *ngIf="errorMessage()" class="alert alert-danger d-flex align-items-center justify-content-between py-2 px-3 mb-4 rounded-3 small">
          <div><i class="bi bi-exclamation-triangle-fill me-2"></i>{{ errorMessage() }}</div>
          <button type="button" class="btn-close btn-close-white" (click)="errorMessage.set('')"></button>
        </div>

        <!-- Sessions Grid -->
        <div *ngIf="isLoading() && sessions().length === 0" class="text-center py-5">
          <div class="spinner-border text-indigo mb-3" role="status"></div>
          <p class="text-secondary">Loading competition sessions...</p>
        </div>

        <div *ngIf="!isLoading() && sessions().length === 0" class="text-center py-5 glass-card rounded-4 p-5">
          <div class="empty-icon mx-auto mb-3">
            <i class="bi bi-folder2-open"></i>
          </div>
          <h2 class="h4 fw-bold text-white mb-2">No Quiz Sessions Found</h2>
          <p class="text-secondary mb-4" style="max-width: 420px; margin: 0 auto;">
            Get started by creating your first real-time physical quiz competition session.
          </p>
          <button class="btn btn-primary-gradient px-4 py-2 fw-bold" (click)="openCreateModal()">
            <i class="bi bi-plus-circle-fill me-2"></i>Create New Session
          </button>
        </div>

        <div *ngIf="sessions().length > 0" class="row g-3 g-md-4">
          <div class="col-12 col-md-6 col-lg-4" *ngFor="let s of sessions()">
            <div class="session-card glass-card p-4 rounded-4 h-100 d-flex flex-column justify-content-between">
              
              <div>
                <!-- Top code & status -->
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <span class="session-code-tag">{{ s.sessionCode }}</span>
                  <span class="badge" [ngClass]="getStatusBadgeClass(s.status)">
                    {{ s.status }}
                  </span>
                </div>

                <!-- Title -->
                <h2 class="h5 fw-bold text-white mb-2 text-truncate" [title]="s.sessionName">
                  {{ s.sessionName }}
                </h2>

                <!-- Stats -->
                <div class="session-meta row g-2 my-3">
                  <div class="col-6">
                    <div class="meta-item p-2 rounded-3 text-center">
                      <span class="meta-label">PARTICIPANTS</span>
                      <span class="meta-value text-indigo">{{ s.participantCount }}</span>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="meta-item p-2 rounded-3 text-center">
                      <span class="meta-label">QUESTIONS</span>
                      <span class="meta-value text-emerald">{{ s.currentQuestionNumber }} / {{ s.totalQuestions }}</span>
                    </div>
                  </div>
                </div>

                <div class="text-secondary small mb-3">
                  <i class="bi bi-calendar3 me-1"></i>
                  Created {{ formatDate(s.createdAt) }}
                </div>
              </div>

              <!-- Action buttons -->
              <div class="d-flex align-items-center gap-2 pt-3 border-top border-secondary border-opacity-25">
                <a [routerLink]="['/admin/sessions', s.id]" class="btn btn-open-session flex-grow-1 py-2 fw-bold text-center text-decoration-none">
                  <i class="bi bi-display me-1"></i>Open Command Center
                </a>
                <button class="btn btn-outline-danger btn-sm p-2 rounded-3" (click)="confirmDelete(s)" title="Delete session">
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Create Session Modal -->
    <div class="modal fade show d-block" *ngIf="showModal()" tabindex="-1" style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-card border-0 rounded-4 p-4 text-white">
          
          <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
            <h2 class="h5 fw-bold text-white mb-0">
              <i class="bi bi-sliders me-2 text-indigo"></i>Create Quiz Session
            </h2>
            <button type="button" class="btn-close btn-close-white" (click)="closeCreateModal()"></button>
          </div>

          <form (ngSubmit)="onCreateSession()">
            
            <div class="mb-3">
              <label class="form-label small fw-bold text-light">SESSION NAME</label>
              <input 
                type="text" 
                class="form-control-modal" 
                name="sessionName"
                [(ngModel)]="newSession.sessionName" 
                required 
                placeholder="e.g. General Knowledge Championship 2026"
              />
            </div>

            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label small fw-bold text-light">SESSION CODE</label>
                <input 
                  type="text" 
                  class="form-control-modal text-uppercase fw-bold" 
                  name="sessionCode"
                  [(ngModel)]="newSession.sessionCode" 
                  required 
                  placeholder="e.g. GK26"
                  maxlength="15"
                />
              </div>
              <div class="col-6">
                <label class="form-label small fw-bold text-light">TOTAL QUESTIONS</label>
                <input 
                  type="number" 
                  class="form-control-modal text-center" 
                  name="totalQuestions"
                  [(ngModel)]="newSession.totalQuestions" 
                  required 
                  min="1" 
                  max="100"
                />
              </div>
            </div>

            <div class="row g-3 mb-3">
              <div class="col-4">
                <label class="form-label small fw-bold text-light">DURATION (S)</label>
                <input 
                  type="number" 
                  class="form-control-modal text-center" 
                  name="questionDurationSeconds"
                  [(ngModel)]="newSession.questionDurationSeconds" 
                  required 
                  min="5" 
                  max="120"
                />
              </div>
              <div class="col-4">
                <label class="form-label small fw-bold text-light">CORRECT PTS</label>
                <input 
                  type="number" 
                  class="form-control-modal text-center" 
                  name="correctAnswerPoints"
                  [(ngModel)]="newSession.correctAnswerPoints" 
                  required 
                  min="1"
                />
              </div>
              <div class="col-4">
                <label class="form-label small fw-bold text-light">FAST BONUS</label>
                <input 
                  type="number" 
                  class="form-control-modal text-center" 
                  name="fastestAnswerBonus"
                  [(ngModel)]="newSession.fastestAnswerBonus" 
                  required 
                  min="0"
                />
              </div>
            </div>

            <div class="form-check form-switch mb-4">
              <input 
                class="form-check-input" 
                type="checkbox" 
                id="revealSwitch" 
                name="revealResults"
                [(ngModel)]="newSession.revealResults"
              />
              <label class="form-check-label small text-light" for="revealSwitch">
                Reveal correct answer and points to participants after scoring
              </label>
            </div>

            <div class="d-flex align-items-center justify-content-end gap-2 pt-3 border-top border-secondary border-opacity-25">
              <button type="button" class="btn btn-outline-secondary px-3 py-2 rounded-3 text-light" (click)="closeCreateModal()">
                Cancel
              </button>
              <button 
                type="submit" 
                class="btn btn-primary-gradient px-4 py-2 rounded-3 fw-bold"
                [disabled]="isCreating() || !newSession.sessionName || !newSession.sessionCode"
              >
                <span *ngIf="!isCreating()"><i class="bi bi-check-lg me-1"></i>Create Session</span>
                <span *ngIf="isCreating()"><span class="spinner-border spinner-border-sm me-1"></span>Creating...</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade show d-block" *ngIf="sessionToDelete()" tabindex="-1" style="background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-card border-danger border-opacity-50 rounded-4 p-4 text-white">
          
          <div class="text-center mb-3">
            <div class="delete-icon mx-auto mb-2">
              <i class="bi bi-exclamation-triangle-fill"></i>
            </div>
            <h2 class="h5 fw-bold text-white mb-1">Delete Competition Session?</h2>
            <p class="text-secondary small mb-0">
              This action will permanently delete <strong>{{ sessionToDelete()?.sessionName }}</strong> ({{ sessionToDelete()?.sessionCode }}) along with all participants, answers, and scores.
            </p>
          </div>

          <div class="d-flex align-items-center justify-content-center gap-3 pt-3 border-top border-secondary border-opacity-25">
            <button type="button" class="btn btn-outline-secondary px-3 py-2 rounded-3 text-light" (click)="sessionToDelete.set(null)">
              Cancel
            </button>
            <button type="button" class="btn btn-danger px-4 py-2 rounded-3 fw-bold" (click)="onDeleteSession()" [disabled]="isDeleting()">
              <span *ngIf="!isDeleting()"><i class="bi bi-trash3 me-1"></i>Confirm Delete</span>
              <span *ngIf="isDeleting()"><span class="spinner-border spinner-border-sm me-1"></span>Deleting...</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .sessions-wrapper {
      background-color: #0b0f19;
      color: #f8fafc;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .btn-primary-gradient {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      transition: all 0.2s ease;
    }
    .btn-primary-gradient:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
    }
    .text-indigo { color: #818cf8 !important; }
    .text-emerald { color: #34d399 !important; }
    .bg-indigo-subtle { background: rgba(99, 102, 241, 0.15); }
    .session-code-tag {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.5);
      color: #c7d2fe;
      padding: 4px 10px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
    }
    .session-card {
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .session-card:hover {
      transform: translateY(-3px);
      border-color: rgba(99, 102, 241, 0.4);
    }
    .meta-item {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .meta-label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #94a3b8;
    }
    .meta-value {
      font-size: 1.1rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }
    .btn-open-session {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
      border-radius: 10px;
      transition: all 0.2s ease;
    }
    .btn-open-session:hover {
      background: rgba(99, 102, 241, 0.35);
      color: #ffffff;
      border-color: #818cf8;
    }
    .form-control-modal {
      width: 100%;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: #f8fafc;
      padding: 10px 14px;
      font-size: 0.95rem;
    }
    .form-control-modal:focus {
      outline: none;
      border-color: #818cf8;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .empty-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      color: #818cf8;
    }
    .delete-icon {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      color: #ef4444;
    }
    .spin {
      animation: spin 1s infinite linear;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class SessionListComponent implements OnInit {
  public sessions = signal<SessionListItemDto[]>([]);
  public isLoading = signal<boolean>(false);
  public isCreating = signal<boolean>(false);
  public isDeleting = signal<boolean>(false);
  public showModal = signal<boolean>(false);
  public sessionToDelete = signal<SessionListItemDto | null>(null);
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');

  public newSession: CreateSessionRequest = {
    sessionName: '',
    sessionCode: '',
    totalQuestions: 25,
    questionDurationSeconds: 15,
    correctAnswerPoints: 10,
    fastestAnswerBonus: 5,
    revealResults: true
  };

  constructor(
    private adminApi: AdminApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  public loadSessions(): void {
    this.isLoading.set(true);
    this.adminApi.getSessions().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Could not load sessions.');
      }
    });
  }

  public openCreateModal(): void {
    this.newSession = {
      sessionName: '',
      sessionCode: 'GK' + Math.floor(10 + Math.random() * 90),
      totalQuestions: 25,
      questionDurationSeconds: 15,
      correctAnswerPoints: 10,
      fastestAnswerBonus: 5,
      revealResults: true
    };
    this.showModal.set(true);
  }

  public closeCreateModal(): void {
    this.showModal.set(false);
  }

  public onCreateSession(): void {
    if (!this.newSession.sessionName.trim() || !this.newSession.sessionCode.trim()) return;

    this.isCreating.set(true);
    this.adminApi.createSession(this.newSession).subscribe({
      next: (created) => {
        this.isCreating.set(false);
        this.showModal.set(false);
        this.successMessage.set(`Session '${created.sessionCode}' created successfully!`);
        this.loadSessions();
        this.router.navigate(['/admin/sessions', created.id]);
      },
      error: (err) => {
        this.isCreating.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to create session.');
      }
    });
  }

  public confirmDelete(session: SessionListItemDto): void {
    this.sessionToDelete.set(session);
  }

  public onDeleteSession(): void {
    const s = this.sessionToDelete();
    if (!s) return;

    this.isDeleting.set(true);
    this.adminApi.deleteSession(s.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.sessionToDelete.set(null);
        this.successMessage.set(`Session '${s.sessionCode}' and all associated data deleted.`);
        this.loadSessions();
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to delete session.');
      }
    });
  }

  public getStatusBadgeClass(status: SessionStatus): string {
    switch (status) {
      case SessionStatus.Voting: return 'bg-danger text-white animate-pulse';
      case SessionStatus.Waiting: return 'bg-primary text-white';
      case SessionStatus.AnswerReveal: return 'bg-warning text-dark';
      case SessionStatus.Completed: return 'bg-success text-white';
      default: return 'bg-secondary text-white';
    }
  }

  public formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

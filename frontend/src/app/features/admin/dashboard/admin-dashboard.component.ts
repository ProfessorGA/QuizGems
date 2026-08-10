import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';
import { SoundService } from '../../../core/services/sound.service';
import { TimerDisplayComponent } from '../../../shared/components/timer-display/timer-display.component';
import { ConnectionBadgeComponent } from '../../../shared/components/connection-badge/connection-badge.component';
import {
  SessionDetailDto,
  ParticipantHubDto,
  ScoreboardEntryDto,
  QuestionResultHubDto,
  FinalScoreboardDto,
  SessionStatus
} from '../../../core/models/quiz.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TimerDisplayComponent, ConnectionBadgeComponent],
  template: `
    <div class="admin-dashboard-wrapper py-3 px-3 px-md-4 min-vh-100">
      
      <!-- Top Command Bar -->
      <div class="dashboard-header glass-card p-3 rounded-4 mb-4">
        <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          
          <!-- Left: Session Title & Code -->
          <div class="d-flex align-items-center gap-3">
            <a routerLink="/admin/sessions" class="btn btn-icon-round" title="Back to Sessions">
              <i class="bi bi-arrow-left"></i>
            </a>
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="session-code-pill">{{ session()?.sessionCode }}</span>
                <span class="badge" [ngClass]="getStatusBadgeClass(session()?.status)">
                  {{ session()?.status }}
                </span>
              </div>
              <h1 class="h4 fw-bold text-white mb-0 text-truncate" style="max-width: 380px;">
                {{ session()?.sessionName || 'Loading...' }}
              </h1>
            </div>
          </div>

          <!-- Center: Question # / Total -->
          <div class="question-tracker text-center d-none d-lg-block" *ngIf="session()">
            <span class="text-secondary small fw-bold text-uppercase d-block">QUESTION PROGRESS</span>
            <span class="tracker-numbers">
              {{ session()?.currentQuestionNumber }} <small class="text-secondary">/ {{ session()?.totalQuestions }}</small>
            </span>
          </div>

          <!-- Right: Live Attendance, Sound, Actions -->
          <div class="d-flex align-items-center gap-2 gap-md-3">
            
            <div class="attendance-pill d-flex align-items-center gap-2 px-3 py-2 rounded-3">
              <i class="bi bi-people-fill text-indigo"></i>
              <div>
                <span class="text-secondary small d-block" style="font-size: 0.65rem; line-height: 1;">CONTESTANTS</span>
                <span class="fw-bold text-white">{{ participants().length }}</span>
              </div>
            </div>

            <app-connection-badge></app-connection-badge>

            <button 
              class="btn-icon-round" 
              (click)="sound.toggleMute()" 
              [title]="sound.isMuted() ? 'Unmute Audio' : 'Mute Audio'"
            >
              <i class="bi" [ngClass]="sound.isMuted() ? 'bi-volume-mute-fill text-danger' : 'bi-volume-up-fill text-success'"></i>
            </button>

            <button 
              class="btn btn-outline-warning btn-sm px-3 py-2 rounded-3 fw-bold" 
              (click)="onResetParticipants()"
              [disabled]="isActionLoading()"
              title="Clear participants and answers for a clean fresh start"
            >
              <i class="bi bi-arrow-counterclockwise me-1"></i>Reset Players
            </button>

            <button 
              *ngIf="session()?.status !== 'Completed'"
              class="btn btn-outline-danger btn-sm px-3 py-2 rounded-3 fw-bold" 
              (click)="onTerminateSession()"
              [disabled]="isActionLoading()"
              title="End tournament and kick all players to final podium while preserving export log"
            >
              <i class="bi bi-stop-circle-fill me-1"></i>End Session
            </button>

            <button class="btn btn-outline-danger btn-sm px-3 py-2 rounded-3 fw-bold" (click)="confirmDeleteSession()">
              <i class="bi bi-trash3-fill me-1"></i>Delete
            </button>
          </div>

        </div>
      </div>

      <!-- Main Command Arena (2 Columns) -->
      <div class="row g-4 mb-4">
        
        <!-- Left: Primary Control Panel (Interactive Arena) -->
        <div class="col-12 col-xl-7">
          <div class="control-arena glass-card p-4 rounded-4 h-100 d-flex flex-column justify-content-between">
            
            <!-- STAGE 1: CREATED / WAITING -> START VOTING -->
            <div *ngIf="session()?.status === 'Created' || session()?.status === 'Waiting'" class="text-center py-4 my-auto">
              
              <div class="stage-tag mx-auto mb-3">
                <i class="bi bi-mic-fill text-indigo me-1"></i>PHYSICAL ROOM ARENA
              </div>

              <h2 class="h3 fw-bold text-white mb-2">
                Question {{ session()?.currentQuestionNumber }} of {{ session()?.totalQuestions }}
              </h2>
              
              <p class="text-secondary small mb-4" style="max-width: 480px; margin: 0 auto;">
                Quiz Master: Physically read Question {{ session()?.currentQuestionNumber }} and the four options to the room. When ready, click below to open the {{ session()?.questionDurationSeconds }}s voting window on participant devices.
              </p>

              <button 
                class="btn btn-start-voting px-5 py-3 fw-bold text-uppercase"
                (click)="onStartVoting()"
                [disabled]="isActionLoading() || participants().length === 0"
              >
                <i class="bi bi-play-circle-fill me-2 fs-5"></i>
                <span>START VOTING ({{ session()?.questionDurationSeconds }}s)</span>
              </button>

              <div *ngIf="participants().length === 0" class="text-warning small mt-3">
                <i class="bi bi-exclamation-triangle me-1"></i>Waiting for participants to join session code <strong>{{ session()?.sessionCode }}</strong>
              </div>

            </div>

            <!-- STAGE 2: VOTING OPEN -> TIMER & REAL-TIME MONITORING -->
            <div *ngIf="session()?.status === 'Voting'" class="text-center py-3 my-auto">
              
              <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="badge bg-danger animate-pulse px-3 py-1 rounded-pill fw-bold">
                  ● VOTING IN PROGRESS
                </span>
                <span class="text-secondary small fw-bold">
                  QUESTION {{ session()?.currentQuestionNumber }} / {{ session()?.totalQuestions }}
                </span>
              </div>

              <!-- Radial Countdown Timer -->
              <div class="my-3">
                <app-timer-display 
                  [remainingSeconds]="remainingSeconds()" 
                  [totalDuration]="session()?.questionDurationSeconds || 15"
                ></app-timer-display>
              </div>

              <!-- Live Submission Counter -->
              <div class="live-counter-box p-3 rounded-4 mb-3 mx-auto" style="max-width: 360px;">
                <span class="text-secondary small fw-bold d-block mb-1">ANSWERS RECEIVED</span>
                <div class="counter-display">
                  <span class="text-emerald">{{ answeredCount() }}</span>
                  <span class="text-secondary"> / </span>
                  <span class="text-white">{{ participants().length }}</span>
                </div>
                <div class="progress mt-2" style="height: 6px; background: rgba(255,255,255,0.1);">
                  <div 
                    class="progress-bar bg-success" 
                    role="progressbar" 
                    [style.width.%]="(answeredCount() / (participants().length || 1)) * 100"
                  ></div>
                </div>
              </div>

              <button class="btn btn-outline-danger px-4 py-2 rounded-3 fw-bold" (click)="onEndVotingEarly()" [disabled]="isActionLoading()">
                <i class="bi bi-stop-circle-fill me-1"></i>End Voting Early
              </button>

            </div>

            <!-- STAGE 3: VOTING ENDED -> SELECT CORRECT OPTION -->
            <div *ngIf="session()?.status === 'VotingEnded'" class="py-3 my-auto">
              
              <div class="text-center mb-3">
                <span class="badge bg-warning text-dark px-3 py-1 rounded-pill fw-bold mb-2">
                  VOTING CLOSED • SELECT CORRECT OPTION
                </span>
                <h2 class="h4 fw-bold text-white mb-1">
                  Which option is correct for Question {{ session()?.currentQuestionNumber }}?
                </h2>
                <p class="text-secondary small mb-0">Total answered: {{ answeredCount() }} / {{ participants().length }}</p>
              </div>

              <!-- Four Option Selector Cards -->
              <div class="row g-3 my-2 max-opt-width mx-auto">
                <div class="col-6" *ngFor="let opt of [1, 2, 3, 4]">
                  <button 
                    type="button" 
                    class="btn-opt-select w-100 p-3 rounded-3"
                    [class.selected]="selectedCorrectOption() === opt"
                    [ngClass]="'opt-btn-' + opt"
                    (click)="selectedCorrectOption.set(opt)"
                  >
                    <div class="d-flex align-items-center justify-content-between">
                      <span class="fw-bold fs-5">OPTION {{ opt }}</span>
                      <i class="bi bi-check-circle-fill fs-5" *ngIf="selectedCorrectOption() === opt"></i>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Confirm Answer Button -->
              <div class="text-center mt-4">
                <button 
                  class="btn btn-primary-gradient px-5 py-3 rounded-3 fw-bold text-uppercase"
                  [disabled]="!selectedCorrectOption() || isActionLoading()"
                  (click)="onConfirmCorrectAnswer()"
                >
                  <i class="bi bi-award-fill me-2"></i>CONFIRM & SCORE QUESTION
                </button>
              </div>

            </div>

            <!-- STAGE 4: ANSWER REVEAL / SCORING -> RESULTS & ADVANCE -->
            <div *ngIf="session()?.status === 'AnswerReveal' || session()?.status === 'Scoring'" class="py-3 my-auto">
              
              <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="badge bg-success px-3 py-1 rounded-pill fw-bold">QUESTION SCORED</span>
                <span class="text-secondary small fw-bold">QUESTION {{ session()?.currentQuestionNumber }} / {{ session()?.totalQuestions }}</span>
              </div>

              <!-- Correct Option Highlight -->
              <div class="correct-banner p-3 rounded-4 text-center mb-3">
                <span class="text-secondary small fw-bold d-block mb-1">CORRECT ANSWER</span>
                <h2 class="correct-title text-success mb-0">OPTION {{ currentQuestionResult()?.correctOption }}</h2>
              </div>

              <!-- Fastest Contestant Spotlight 🏆 -->
              <div *ngIf="currentQuestionResult()?.fastestParticipant as fastest" class="fastest-winner-card p-3 rounded-4 mb-3">
                <div class="d-flex align-items-center justify-content-between">
                  <div class="d-flex align-items-center gap-3">
                    <div class="trophy-badge">🏆</div>
                    <div>
                      <span class="text-warning small fw-bold text-uppercase d-block">FASTEST CORRECT ANSWER</span>
                      <h3 class="h5 fw-bold text-white mb-0">{{ fastest.fullName }}</h3>
                    </div>
                  </div>
                  <div class="text-end">
                    <span class="badge bg-warning text-dark fw-bold px-3 py-1 rounded-pill mb-1 d-inline-block">
                      +{{ session()?.fastestAnswerBonus }} BONUS PTS
                    </span>
                    <div class="text-warning small fw-bold">{{ fastest.responseSeconds }}s</div>
                  </div>
                </div>
              </div>

              <!-- Question Stats Breakdown -->
              <div class="row g-2 mb-4" *ngIf="currentQuestionResult() as res">
                <div class="col-4">
                  <div class="stat-mini p-2 rounded-3 text-center">
                    <span class="stat-mini-label text-success">CORRECT</span>
                    <span class="stat-mini-val text-white">{{ res.correctCount }}</span>
                  </div>
                </div>
                <div class="col-4">
                  <div class="stat-mini p-2 rounded-3 text-center">
                    <span class="stat-mini-label text-danger">WRONG</span>
                    <span class="stat-mini-val text-white">{{ res.wrongCount }}</span>
                  </div>
                </div>
                <div class="col-4">
                  <div class="stat-mini p-2 rounded-3 text-center">
                    <span class="stat-mini-label text-secondary">NO ANSWER</span>
                    <span class="stat-mini-val text-white">{{ res.noAnswerCount }}</span>
                  </div>
                </div>
              </div>

              <!-- Action: Next Question or Complete -->
              <div class="text-center">
                <button 
                  *ngIf="session()!.currentQuestionNumber < session()!.totalQuestions"
                  class="btn btn-primary-gradient px-5 py-3 rounded-3 fw-bold text-uppercase"
                  (click)="onNextQuestion()"
                  [disabled]="isActionLoading()"
                >
                  <span>NEXT QUESTION ({{ session()!.currentQuestionNumber + 1 }} / {{ session()!.totalQuestions }})</span>
                  <i class="bi bi-arrow-right-circle-fill ms-2"></i>
                </button>

                <button 
                  *ngIf="session()!.currentQuestionNumber >= session()!.totalQuestions"
                  class="btn btn-success px-5 py-3 rounded-3 fw-bold text-uppercase shadow-lg"
                  (click)="onCompleteQuiz()"
                  [disabled]="isActionLoading()"
                >
                  <i class="bi bi-trophy-fill me-2"></i>COMPLETE QUIZ & SHOW PODIUM
                </button>
              </div>

            </div>

            <!-- STAGE 5: COMPLETED -> TOURNAMENT PODIUM -->
            <div *ngIf="session()?.status === 'Completed'" class="text-center py-4 my-auto">
              <div class="trophy-hero mx-auto mb-2">🏆</div>
              <h2 class="h3 fw-bold text-white mb-1">GRAND FINALE PODIUM</h2>
              <p class="text-secondary small mb-4">All {{ session()?.totalQuestions }} questions have been evaluated.</p>

              <!-- Top 3 Podium Visual -->
              <div class="row g-2 justify-content-center align-items-end mb-4" *ngIf="scoreboard().length > 0">
                
                <!-- 2nd Place (Silver) -->
                <div class="col-4" *ngIf="scoreboard().length >= 2">
                  <div class="podium-card p-3 rounded-4 bg-surface border border-secondary border-opacity-25" style="height: 170px;">
                    <span class="fs-3 d-block mb-1">🥈</span>
                    <span class="badge bg-secondary mb-1">#2 SILVER</span>
                    <strong class="text-white d-block text-truncate small">{{ scoreboard()[1].fullName }}</strong>
                    <span class="text-indigo fw-bold fs-6">{{ scoreboard()[1].totalScore }} pts</span>
                  </div>
                </div>

                <!-- 1st Place (Gold Champion) -->
                <div class="col-4">
                  <div class="podium-card p-3 rounded-4 bg-surface border border-warning shadow-lg" style="height: 200px; background: rgba(245, 158, 11, 0.1) !important;">
                    <span class="fs-1 d-block mb-1">👑</span>
                    <span class="badge bg-warning text-dark fw-bold mb-1">#1 CHAMPION</span>
                    <strong class="text-white d-block text-truncate">{{ scoreboard()[0].fullName }}</strong>
                    <span class="text-warning fw-bold fs-5">{{ scoreboard()[0].totalScore }} pts</span>
                  </div>
                </div>

                <!-- 3rd Place (Bronze) -->
                <div class="col-4" *ngIf="scoreboard().length >= 3">
                  <div class="podium-card p-3 rounded-4 bg-surface border border-secondary border-opacity-25" style="height: 150px;">
                    <span class="fs-3 d-block mb-1">🥉</span>
                    <span class="badge bg-dark border border-secondary text-secondary mb-1">#3 BRONZE</span>
                    <strong class="text-white d-block text-truncate small">{{ scoreboard()[2].fullName }}</strong>
                    <span class="text-indigo fw-bold fs-6">{{ scoreboard()[2].totalScore }} pts</span>
                  </div>
                </div>

              </div>

              <div class="d-flex align-items-center justify-content-center gap-3">
                <button class="btn btn-primary-gradient px-4 py-2 fw-bold" (click)="exportCsv()">
                  <i class="bi bi-download me-2"></i>Export Results CSV
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- Right: Live Scoreboard Tab -->
        <div class="col-12 col-xl-5">
          <div class="scoreboard-panel glass-card p-4 rounded-4 h-100 d-flex flex-column">
            
            <div class="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-trophy-fill text-warning"></i>
                <h2 class="h5 fw-bold text-white mb-0">LIVE SCOREBOARD</h2>
              </div>
              <button class="btn btn-outline-secondary btn-sm px-2 py-1" (click)="exportCsv()" title="Export CSV">
                <i class="bi bi-file-earmark-spreadsheet me-1"></i>CSV
              </button>
            </div>

            <div class="scoreboard-list flex-grow-1 overflow-auto pe-1" style="max-height: 480px;">
              <div *ngIf="scoreboard().length === 0" class="text-center py-4 text-secondary small">
                No scores recorded yet.
              </div>

              <div 
                *ngFor="let entry of scoreboard()" 
                class="scoreboard-row d-flex align-items-center justify-content-between p-2 rounded-3 mb-2"
                [class.top-1]="entry.rank === 1"
                [class.top-2]="entry.rank === 2"
                [class.top-3]="entry.rank === 3"
              >
                <div class="d-flex align-items-center gap-3">
                  <div class="rank-circle fw-bold">{{ entry.rank }}</div>
                  <div>
                    <strong class="contestant-name text-white d-block text-truncate" style="max-width: 170px;">
                      {{ entry.fullName }}
                    </strong>
                    <span class="text-secondary" style="font-size: 0.7rem;">
                      {{ entry.correctAnswersCount }} correct • {{ entry.fastestWinsCount }} ⚡ fastest
                    </span>
                  </div>
                </div>

                <div class="text-end">
                  <span class="score-points fw-bold fs-5 text-indigo">{{ entry.totalScore }}</span>
                  <span class="text-secondary small d-block" style="font-size: 0.65rem;">PTS</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- Bottom Tabbed Section: Participants Live Grid -->
      <div class="glass-card p-4 rounded-4 mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-phone-fill text-indigo"></i>
            <h2 class="h5 fw-bold text-white mb-0">PARTICIPANT MONITORING</h2>
            <span class="badge bg-indigo-subtle text-indigo ms-2">{{ participants().length }} Active</span>
          </div>
        </div>

        <div class="row g-2 g-md-3">
          <div class="col-12 col-sm-6 col-md-4 col-lg-3" *ngFor="let p of participants()">
            <div class="participant-box p-3 rounded-3 d-flex align-items-center justify-content-between">
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="status-dot" [class.connected]="p.isConnected"></span>
                  <strong class="text-white text-truncate" style="max-width: 130px;" [title]="p.fullName">
                    {{ p.fullName }}
                  </strong>
                </div>
                <span class="text-secondary small">Score: {{ p.totalScore }} pts</span>
              </div>

              <!-- Answer Status Indicator -->
              <div>
                <span *ngIf="p.hasAnsweredCurrentQuestion" class="badge bg-success-subtle text-success">
                  <i class="bi bi-check-lg me-1"></i>Answered
                </span>
                <span *ngIf="!p.hasAnsweredCurrentQuestion && session()?.status === 'Voting'" class="badge bg-secondary-subtle text-secondary">
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade show d-block" *ngIf="showDeleteModal()" tabindex="-1" style="background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content glass-card border-danger border-opacity-50 rounded-4 p-4 text-white">
          <div class="text-center mb-3">
            <i class="bi bi-exclamation-triangle-fill text-danger fs-1 mb-2"></i>
            <h2 class="h5 fw-bold text-white">Delete Session & Temporary Data?</h2>
            <p class="text-secondary small">
              This will remove session <strong>{{ session()?.sessionCode }}</strong> and delete all related participant and answer records permanently.
            </p>
          </div>

          <div class="d-flex align-items-center justify-content-center gap-3 pt-3 border-top border-secondary border-opacity-25">
            <button type="button" class="btn btn-outline-secondary px-3 py-2 rounded-3 text-light" (click)="showDeleteModal.set(false)">
              Cancel
            </button>
            <button type="button" class="btn btn-danger px-4 py-2 rounded-3 fw-bold" (click)="onDeleteSession()">
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-dashboard-wrapper {
      background-color: #0b0f19;
      color: #f8fafc;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.88);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .btn-icon-round {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn-icon-round:hover {
      background: rgba(255, 255, 255, 0.18);
    }
    .session-code-pill {
      background: rgba(99, 102, 241, 0.25);
      border: 1px solid rgba(99, 102, 241, 0.6);
      color: #c7d2fe;
      padding: 2px 10px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 0.85rem;
    }
    .text-indigo { color: #818cf8 !important; }
    .text-emerald { color: #34d399 !important; }
    .bg-indigo-subtle { background: rgba(99, 102, 241, 0.15); }
    .bg-success-subtle { background: rgba(16, 185, 129, 0.15); }
    .bg-secondary-subtle { background: rgba(100, 116, 139, 0.15); }
    
    .attendance-pill {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .stage-tag {
      display: inline-flex;
      align-items: center;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
    }
    .btn-start-voting {
      background: linear-gradient(135deg, #10b981, #059669);
      border: none;
      color: #ffffff;
      border-radius: 14px;
      font-size: 1.15rem;
      letter-spacing: 0.04em;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
      transition: all 0.25s ease;
    }
    .btn-start-voting:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba(16, 185, 129, 0.6);
    }
    .btn-primary-gradient {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: #ffffff;
      box-shadow: 0 6px 18px rgba(99, 102, 241, 0.4);
    }

    .live-counter-box {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .counter-display {
      font-size: 2rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }

    .max-opt-width {
      max-width: 480px;
    }
    .btn-opt-select {
      background: rgba(15, 23, 42, 0.8);
      border: 2px solid rgba(255, 255, 255, 0.12);
      color: #f8fafc;
      transition: all 0.2s ease;
    }
    .btn-opt-select.selected {
      transform: scale(1.03);
      border-width: 3px;
    }
    .opt-btn-1.selected { border-color: #818cf8; background: rgba(99, 102, 241, 0.2); }
    .opt-btn-2.selected { border-color: #34d399; background: rgba(16, 185, 129, 0.2); }
    .opt-btn-3.selected { border-color: #fbbf24; background: rgba(245, 158, 11, 0.2); }
    .opt-btn-4.selected { border-color: #fb7185; background: rgba(244, 63, 94, 0.2); }

    .correct-banner {
      background: rgba(16, 185, 129, 0.12);
      border: 1.5px solid rgba(16, 185, 129, 0.4);
    }
    .correct-title {
      font-size: 1.8rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
    }
    .fastest-winner-card {
      background: rgba(245, 158, 11, 0.12);
      border: 1.5px solid rgba(245, 158, 11, 0.4);
    }
    .trophy-badge {
      font-size: 2rem;
    }
    .stat-mini {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .stat-mini-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      display: block;
    }
    .stat-mini-val {
      font-size: 1.2rem;
      font-weight: 800;
    }

    .scoreboard-row {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: background 0.2s ease;
    }
    .scoreboard-row.top-1 {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.4);
    }
    .scoreboard-row.top-2 {
      background: rgba(148, 163, 184, 0.12);
      border-color: rgba(148, 163, 184, 0.3);
    }
    .scoreboard-row.top-3 {
      background: rgba(180, 83, 9, 0.12);
      border-color: rgba(180, 83, 9, 0.3);
    }
    .rank-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
    }

    .participant-box {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #64748b;
    }
    .status-dot.connected {
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }
    .trophy-hero {
      font-size: 4rem;
    }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  public sessionId: string = '';
  public session = signal<SessionDetailDto | null>(null);
  public participants = signal<ParticipantHubDto[]>([]);
  public scoreboard = signal<ScoreboardEntryDto[]>([]);
  public currentQuestionResult = signal<QuestionResultHubDto | null>(null);
  public finalScoreboard = signal<FinalScoreboardDto | null>(null);

  public isActionLoading = signal<boolean>(false);
  public showDeleteModal = signal<boolean>(false);
  public selectedCorrectOption = signal<number | null>(null);

  public remainingSeconds = signal<number>(0);
  public answeredCount = signal<number>(0);

  private timerInterval: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminApi: AdminApiService,
    private signalR: QuizSignalRService,
    public sound: SoundService
  ) {}

  async ngOnInit(): Promise<void> {
    this.sessionId = this.route.snapshot.paramMap.get('id') || '';
    if (this.sessionId) {
      await this.loadSessionData();
    }
    this.subscribeToRealtime();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private async loadSessionData(): Promise<void> {
    this.adminApi.getSessionById(this.sessionId).subscribe({
      next: async (s) => {
        this.session.set(s);
        this.answeredCount.set(s.activeQuestionAnsweredCount || 0);

        // Start SignalR connection with Admin role
        try {
          await this.signalR.startConnection(s.sessionCode, undefined, true);
        } catch (err) {
          console.error('SignalR start error:', err);
        }

        this.loadParticipants();
        this.loadScoreboard();

        // If voting is active, restore countdown
        if (s.status === SessionStatus.Voting) {
          this.startCountdownTimer(s.questionDurationSeconds || 15);
        }
      },
      error: (err) => {
        console.error('Error loading session:', err);
        this.router.navigate(['/admin/sessions']);
      }
    });
  }

  private loadParticipants(): void {
    this.adminApi.getParticipants(this.sessionId).subscribe({
      next: (pts) => {
        this.participants.set(pts);
        this.answeredCount.set(pts.filter(p => p.hasAnsweredCurrentQuestion).length);
      }
    });
  }

  private loadScoreboard(): void {
    this.adminApi.getScoreboard(this.sessionId).subscribe({
      next: (sb) => this.scoreboard.set(sb)
    });
  }

  private subscribeToRealtime(): void {
    this.signalR.participantJoined$.subscribe(p => {
      const current = this.participants();
      const existing = current.findIndex(x => x.id === p.id);
      if (existing >= 0) {
        const updated = [...current];
        updated[existing] = p;
        this.participants.set(updated);
      } else {
        this.participants.set([...current, p]);
      }
    });

    this.signalR.participantDisconnected$.subscribe(({ participantId }) => {
      const current = this.participants();
      this.participants.set(
        current.map(p => p.id === participantId ? { ...p, isConnected: false } : p)
      );
    });

    this.signalR.participantReconnected$.subscribe(({ participantId }) => {
      const current = this.participants();
      this.participants.set(
        current.map(p => p.id === participantId ? { ...p, isConnected: true } : p)
      );
    });

    this.signalR.votingStarted$.subscribe(dto => {
      const s = this.session();
      if (s) {
        this.session.set({ ...s, status: SessionStatus.Voting, currentQuestionNumber: dto.questionNumber });
      }
      this.answeredCount.set(0);
      this.selectedCorrectOption.set(null);
      this.currentQuestionResult.set(null);
      const duration = dto.durationSeconds || this.session()?.questionDurationSeconds || 15;
      this.startCountdownTimer(duration);
    });

    this.signalR.votingEnded$.subscribe(dto => {
      const s = this.session();
      if (s) {
        this.session.set({ ...s, status: SessionStatus.VotingEnded });
      }
      this.stopCountdownTimer();
      this.answeredCount.set(dto.totalAnswered);
      this.sound.playTimeUp();
    });

    this.signalR.answerSubmitted$.subscribe(dto => {
      this.answeredCount.set(dto.totalAnswered);
      const current = this.participants();
      this.participants.set(
        current.map(p => p.id === dto.participantId ? { ...p, hasAnsweredCurrentQuestion: true } : p)
      );
    });

    this.signalR.questionResult$.subscribe(dto => {
      this.currentQuestionResult.set(dto);
      const s = this.session();
      if (s) {
        this.session.set({ ...s, status: SessionStatus.AnswerReveal });
      }
    });

    this.signalR.scoreboardUpdated$.subscribe(sb => {
      this.scoreboard.set(sb);
      this.loadParticipants();
    });

    this.signalR.nextQuestion$.subscribe(dto => {
      const s = this.session();
      if (s) {
        this.session.set({ ...s, status: SessionStatus.Waiting, currentQuestionNumber: dto.questionNumber });
      }
      this.answeredCount.set(0);
      this.selectedCorrectOption.set(null);
      this.currentQuestionResult.set(null);
      this.loadParticipants();
    });

    this.signalR.quizCompleted$.subscribe(dto => {
      this.finalScoreboard.set(dto);
      const s = this.session();
      if (s) {
        this.session.set({ ...s, status: SessionStatus.Completed });
      }
      this.sound.playFastestFanfare();
    });
  }

  private startCountdownTimer(durationSeconds: number): void {
    this.stopCountdownTimer();
    const duration = durationSeconds > 0 ? durationSeconds : 15;
    this.remainingSeconds.set(duration);

    const startLocalMs = performance.now();
    const targetMs = duration * 1000;

    const update = () => {
      const elapsedMs = performance.now() - startLocalMs;
      const remainingMs = Math.max(0, targetMs - elapsedMs);
      const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
      this.remainingSeconds.set(seconds);

      if (seconds <= 5 && seconds > 0) {
        this.sound.playTick();
      }

      if (remainingMs <= 0) {
        this.stopCountdownTimer();
      }
    };
    update();
    this.timerInterval = setInterval(update, 100);
  }

  private stopCountdownTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public onStartVoting(): void {
    this.isActionLoading.set(true);
    this.adminApi.startVoting(this.sessionId).subscribe({
      next: (dto) => {
        this.isActionLoading.set(false);
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to start voting.');
      }
    });
  }

  public onEndVotingEarly(): void {
    this.isActionLoading.set(true);
    this.adminApi.endVoting(this.sessionId).subscribe({
      next: () => this.isActionLoading.set(false),
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to end voting.');
      }
    });
  }

  public onConfirmCorrectAnswer(): void {
    const opt = this.selectedCorrectOption();
    if (!opt) return;

    this.isActionLoading.set(true);
    this.adminApi.setCorrectAnswer(this.sessionId, opt).subscribe({
      next: (result) => {
        this.isActionLoading.set(false);
        this.currentQuestionResult.set(result);
        if (result.fastestParticipant) {
          this.sound.playFastestFanfare();
        } else {
          this.sound.playCorrect();
        }
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to score question.');
      }
    });
  }

  public onNextQuestion(): void {
    this.isActionLoading.set(true);
    this.adminApi.nextQuestion(this.sessionId).subscribe({
      next: () => this.isActionLoading.set(false),
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to advance to next question.');
      }
    });
  }

  public onCompleteQuiz(): void {
    this.isActionLoading.set(true);
    this.adminApi.completeQuiz(this.sessionId).subscribe({
      next: (final) => {
        this.isActionLoading.set(false);
        this.finalScoreboard.set(final);
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to complete quiz.');
      }
    });
  }

  public onResetParticipants(): void {
    if (!confirm('Are you sure you want to reset all contestants? This will clear participants and answers for this session, allowing a clean fresh start.')) {
      return;
    }
    this.isActionLoading.set(true);
    this.adminApi.resetParticipants(this.sessionId).subscribe({
      next: (res) => {
        this.isActionLoading.set(false);
        this.participants.set([]);
        this.scoreboard.set([]);
        this.currentQuestionResult.set(null);
        this.answeredCount.set(0);
        this.selectedCorrectOption.set(null);
        const s = this.session();
        if (s) {
          this.session.set({ ...s, status: SessionStatus.Waiting, currentQuestionNumber: 1 });
        }
        alert(res.message || 'Session contestants cleared. Fresh start ready.');
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to reset contestants.');
      }
    });
  }

  public onTerminateSession(): void {
    if (!confirm('Are you sure you want to end & terminate this live session? All connected contestant devices will transition to their final celebration podium. Complete audit logs and CSV export will be preserved.')) {
      return;
    }
    this.isActionLoading.set(true);
    this.adminApi.terminateSession(this.sessionId).subscribe({
      next: (final) => {
        this.isActionLoading.set(false);
        this.finalScoreboard.set(final);
        const s = this.session();
        if (s) {
          this.session.set({ ...s, status: SessionStatus.Completed });
        }
        this.sound.playFastestFanfare();
      },
      error: (err) => {
        this.isActionLoading.set(false);
        alert(err.error?.message || 'Failed to terminate session.');
      }
    });
  }

  public exportCsv(): void {
    this.adminApi.exportResults(this.sessionId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quiz_Results_${this.session()?.sessionCode || 'session'}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => alert('Failed to export CSV results.')
    });
  }

  public confirmDeleteSession(): void {
    this.showDeleteModal.set(true);
  }

  public onDeleteSession(): void {
    this.adminApi.deleteSession(this.sessionId).subscribe({
      next: () => {
        this.showDeleteModal.set(false);
        this.router.navigate(['/admin/sessions']);
      },
      error: (err) => alert('Failed to delete session.')
    });
  }

  public getStatusBadgeClass(status?: SessionStatus): string {
    switch (status) {
      case SessionStatus.Voting: return 'bg-danger text-white animate-pulse';
      case SessionStatus.Waiting: return 'bg-primary text-white';
      case SessionStatus.VotingEnded: return 'bg-warning text-dark';
      case SessionStatus.AnswerReveal: return 'bg-info text-dark';
      case SessionStatus.Completed: return 'bg-success text-white';
      default: return 'bg-secondary text-white';
    }
  }
}

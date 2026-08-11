import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConnectionBadgeComponent } from '../connection-badge/connection-badge.component';
import { SoundService } from '../../../core/services/sound.service';
import { QuizStateService } from '../../../core/services/quiz-state.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ConnectionBadgeComponent],
  template: `
    <header class="app-header">
      <div class="container-fluid px-3 px-md-4">
        <div class="d-flex align-items-center justify-content-between py-2">
          
          <!-- Logo / Title -->
          <a routerLink="/" class="brand-logo text-decoration-none d-flex align-items-center gap-2">
            <div class="logo-icon">
              <i class="bi bi-broadcast"></i>
            </div>
            <div class="brand-text">
              <span class="brand-name">QUIZ MASTER</span>
              <span class="brand-tag">PHYSICAL ARENA</span>
            </div>
          </a>

          <!-- Center: Room / Session Info if present -->
          <div class="session-info d-none d-sm-flex align-items-center gap-2" *ngIf="state.sessionCode()">
            <span class="badge-code">{{ state.sessionCode() }}</span>
            <span class="session-label text-truncate" style="max-width: 220px;">
              {{ state.participant()?.sessionName || 'Live Competition' }}
            </span>
          </div>

          <!-- Right Actions -->
          <div class="d-flex align-items-center gap-2 gap-md-3">
            <app-connection-badge></app-connection-badge>

            <!-- Theme switcher button -->
            <button 
              class="btn-icon" 
              (click)="theme.toggleTheme()" 
              [title]="theme.isLight() ? 'Switch to Dark Theme' : 'Switch to Light Theme'"
              aria-label="Toggle Theme"
            >
              <i class="bi" [ngClass]="theme.isLight() ? 'bi-moon-stars-fill text-indigo' : 'bi-sun-fill text-warning'"></i>
            </button>

            <!-- Sound toggle button -->
            <button 
              class="btn-icon" 
              (click)="sound.toggleMute()" 
              [title]="sound.isMuted() ? 'Unmute audio' : 'Mute audio'"
              aria-label="Toggle audio"
            >
              <i class="bi" [ngClass]="sound.isMuted() ? 'bi-volume-mute-fill text-danger' : 'bi-volume-up-fill text-success'"></i>
            </button>

            <!-- Admin portal link -->
            <a routerLink="/admin" class="btn-admin-link text-decoration-none" title="Admin Command Center">
              <i class="bi bi-shield-lock-fill"></i>
              <span class="d-none d-md-inline ms-1">Admin</span>
            </a>
          </div>

        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .brand-logo {
      color: #fff;
    }
    .logo-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }
    .brand-name {
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(90deg, #ffffff, #c7d2fe);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-tag {
      font-size: 0.6rem;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.1em;
    }
    .badge-code {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.5);
      color: #a5b4fc;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .session-label {
      font-size: 0.8rem;
      color: #cbd5e1;
      font-weight: 500;
    }
    .btn-icon {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .btn-admin-link {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #c7d2fe;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      transition: all 0.2s ease;
    }
    .btn-admin-link:hover {
      background: rgba(99, 102, 241, 0.3);
      color: #ffffff;
      border-color: #818cf8;
    }
  `]
})
export class NavbarComponent {
  constructor(
    public sound: SoundService, 
    public state: QuizStateService,
    public theme: ThemeService
  ) {}
}

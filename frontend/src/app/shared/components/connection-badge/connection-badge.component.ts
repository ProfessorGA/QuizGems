import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizSignalRService } from '../../../core/services/quiz-signalr.service';

@Component({
  selector: 'app-connection-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="connection-badge" [ngClass]="statusClass">
      <span class="status-dot"></span>
      <span class="status-label">{{ statusLabel }}</span>
    </div>
  `,
  styles: [`
    .connection-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      transition: all 0.3s ease;
      backdrop-filter: blur(8px);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .connected {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
    }
    .connected .status-dot {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulse-dot 2s infinite;
    }
    .reconnecting {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }
    .reconnecting .status-dot {
      background: #f59e0b;
      animation: spin-pulse 1s infinite linear;
    }
    .disconnected {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
    }
    .disconnected .status-dot {
      background: #ef4444;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    @keyframes spin-pulse {
      0% { transform: rotate(0deg); opacity: 0.6; }
      50% { opacity: 1; }
      100% { transform: rotate(360deg); opacity: 0.6; }
    }
  `]
})
export class ConnectionBadgeComponent {
  constructor(public signalR: QuizSignalRService) {}

  get statusClass(): string {
    const status = this.signalR.connectionStatus();
    switch (status) {
      case 'Connected': return 'connected';
      case 'Reconnecting': return 'reconnecting';
      default: return 'disconnected';
    }
  }

  get statusLabel(): string {
    const status = this.signalR.connectionStatus();
    switch (status) {
      case 'Connected': return 'Connected';
      case 'Reconnecting': return 'Reconnecting...';
      default: return 'Connection Lost';
    }
  }
}

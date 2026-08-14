import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-alert-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- 1. EMERGENCY / HIGH PRIORITY: CENTER SCREEN MODAL POPUP -->
    <div 
      class="emergency-overlay d-flex align-items-center justify-content-center px-3" 
      *ngIf="alertService.emergencyAlert() as emergency"
    >
      <div class="emergency-modal glass-card p-4 p-md-5 rounded-4 text-center animate-emergency-pop" style="max-width: 480px; width: 100%;">
        <div class="emergency-icon-orb mx-auto mb-3">
          <i class="bi" [ngClass]="emergency.icon || 'bi-exclamation-triangle-fill'"></i>
        </div>
        <h2 class="h4 fw-bold text-white mb-2">{{ emergency.title }}</h2>
        <p class="text-secondary small mb-4 line-height-relaxed">{{ emergency.message }}</p>
        <button 
          type="button" 
          class="btn btn-danger-glow w-100 py-2 rounded-3 fw-bold fs-6" 
          (click)="alertService.dismissEmergency()"
        >
          {{ emergency.confirmText || 'Understood' }}
        </button>
      </div>
    </div>

    <!-- 2. MODERATE / MEDIUM PRIORITY: TOP-CENTER SLIDE-DOWN BANNER -->
    <div class="top-alerts-container" *ngIf="alertService.topAlerts().length > 0">
      <div 
        *ngFor="let alert of alertService.topAlerts()" 
        class="top-alert-card glass-card px-3 py-2 rounded-3 mb-2 d-flex align-items-center justify-content-between gap-3 animate-slide-down shadow-lg"
      >
        <div class="d-flex align-items-center gap-2 text-start">
          <div class="top-alert-icon flex-shrink-0">
            <i class="bi" [ngClass]="alert.icon || 'bi-bell-fill'"></i>
          </div>
          <div>
            <strong class="d-block text-white small fw-bold">{{ alert.title }}</strong>
            <span class="text-secondary small d-block" style="font-size: 0.75rem;">{{ alert.message }}</span>
          </div>
        </div>
        <button 
          type="button" 
          class="btn-close btn-close-white btn-sm flex-shrink-0" 
          (click)="alertService.dismissTop(alert.id)"
          aria-label="Close"
        ></button>
      </div>
    </div>

    <!-- 3. LOW / INFO PRIORITY: LEFT-SIDE FLOATING TOASTS -->
    <div class="left-toasts-container" *ngIf="alertService.leftToasts().length > 0">
      <div 
        *ngFor="let toast of alertService.leftToasts()" 
        class="left-toast-card glass-card p-2 px-3 rounded-3 mb-2 d-flex align-items-center gap-2 animate-slide-left shadow"
      >
        <div class="left-toast-icon text-indigo">
          <i class="bi" [ngClass]="toast.icon || 'bi-info-circle-fill'"></i>
        </div>
        <div class="text-start pe-2">
          <strong class="d-block text-white" style="font-size: 0.75rem;">{{ toast.title }}</strong>
          <span class="text-secondary" style="font-size: 0.7rem;">{{ toast.message }}</span>
        </div>
        <button 
          type="button" 
          class="btn-close btn-close-white btn-sm ms-auto" 
          style="font-size: 0.55rem;"
          (click)="alertService.dismissLeft(toast.id)"
          aria-label="Close"
        ></button>
      </div>
    </div>
  `,
  styles: [`
    /* 1. Emergency Center Overlay */
    .emergency-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(4, 7, 16, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 99999;
    }

    .emergency-modal {
      background: rgba(15, 23, 42, 0.95);
      border: 2px solid rgba(239, 68, 68, 0.6) !important;
      box-shadow: 0 0 50px rgba(239, 68, 68, 0.4), 0 25px 50px -12px rgba(0, 0, 0, 0.7) !important;
    }

    [data-theme="light"] .emergency-modal {
      background: rgba(255, 255, 255, 0.98);
      border: 2px solid rgba(239, 68, 68, 0.8) !important;
      box-shadow: 0 0 40px rgba(239, 68, 68, 0.25), 0 20px 40px rgba(0, 0, 0, 0.15) !important;
    }

    .emergency-icon-orb {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.1) 100%);
      border: 2px solid #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ef4444;
      font-size: 2rem;
      animation: emergencyPulse 1.5s infinite ease-in-out;
    }

    @keyframes emergencyPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); }
      50% { transform: scale(1.08); box-shadow: 0 0 30px rgba(239, 68, 68, 0.8); }
    }

    .btn-danger-glow {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
      transition: all 0.2s ease;
    }

    .btn-danger-glow:hover {
      background: linear-gradient(135deg, #f87171, #ef4444);
      box-shadow: 0 6px 25px rgba(239, 68, 68, 0.6);
      transform: translateY(-1px);
    }

    /* 2. Top-Center Moderate Banner */
    .top-alerts-container {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      width: 92%;
      max-width: 480px;
      pointer-events: none;
    }

    .top-alert-card {
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(99, 102, 241, 0.4) !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(99, 102, 241, 0.2);
    }

    [data-theme="light"] .top-alert-card {
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid rgba(99, 102, 241, 0.3) !important;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
    }

    .top-alert-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 0.85rem;
    }

    /* 3. Left-Side Low Toasts */
    .left-toasts-container {
      position: fixed;
      bottom: 24px;
      left: 20px;
      z-index: 9990;
      max-width: 320px;
      pointer-events: none;
    }

    .left-toast-card {
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      backdrop-filter: blur(12px);
    }

    [data-theme="light"] .left-toast-card {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(15, 23, 42, 0.1) !important;
    }

    /* Entrance Animations */
    @keyframes emergencyPop {
      0% { opacity: 0; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    .animate-emergency-pop {
      animation: emergencyPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes slideDown {
      0% { opacity: 0; transform: translateY(-16px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .animate-slide-down {
      animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes slideLeft {
      0% { opacity: 0; transform: translateX(-24px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    .animate-slide-left {
      animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class AlertContainerComponent {
  constructor(public alertService: AlertService) {}
}

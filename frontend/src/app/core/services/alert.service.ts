import { Injectable, signal } from '@angular/core';

export type AlertSeverity = 'emergency' | 'moderate' | 'low';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  icon?: string;
  confirmText?: string;
  durationMs?: number; // 0 for persistent/manual dismiss
  onConfirm?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  // 1. Emergency Alert: Displayed in CENTER screen with backdrop blur
  public emergencyAlert = signal<AlertItem | null>(null);

  // 2. Moderate Alert: Displayed at TOP-CENTER as a slide-down banner
  public topAlerts = signal<AlertItem[]>([]);

  // 3. Low / Info Alert: Displayed on LEFT SIDE as a floating toast
  public leftToasts = signal<AlertItem[]>([]);

  /**
   * High / Emergency Severity (CENTER SCREEN POPUP)
   * Used for: Kicked, Question Cancelled/Voided, Session Terminated, Severe Disconnects
   */
  public emergency(title: string, message: string, options?: { confirmText?: string; icon?: string; onConfirm?: () => void }): void {
    const alert: AlertItem = {
      id: 'emergency_' + Date.now(),
      severity: 'emergency',
      title,
      message,
      icon: options?.icon || 'bi-exclamation-triangle-fill',
      confirmText: options?.confirmText || 'Understood',
      onConfirm: options?.onConfirm
    };
    this.emergencyAlert.set(alert);
  }

  /**
   * Moderate Severity (TOP CENTER BANNER)
   * Used for: Voting Started, Re-entry Warning, Answer Locked, Time Warning, Rename
   */
  public moderate(title: string, message: string, options?: { durationMs?: number; icon?: string }): void {
    const id = 'mod_' + Math.random().toString(36).substring(2, 9);
    const duration = options?.durationMs !== undefined ? options.durationMs : 5000;
    const alert: AlertItem = {
      id,
      severity: 'moderate',
      title,
      message,
      icon: options?.icon || 'bi-bell-fill',
      durationMs: duration
    };

    this.topAlerts.update(list => [alert, ...list.slice(0, 2)]); // Keep at most 3

    if (duration > 0) {
      setTimeout(() => {
        this.dismissTop(id);
      }, duration);
    }
  }

  /**
   * Low Severity / Informational (LEFT SIDE TOAST)
   * Used for: Contestant joined, sound toggle, theme toggle, code copied
   */
  public info(title: string, message: string, options?: { durationMs?: number; icon?: string }): void {
    const id = 'low_' + Math.random().toString(36).substring(2, 9);
    const duration = options?.durationMs !== undefined ? options.durationMs : 3500;
    const alert: AlertItem = {
      id,
      severity: 'low',
      title,
      message,
      icon: options?.icon || 'bi-info-circle-fill',
      durationMs: duration
    };

    this.leftToasts.update(list => [alert, ...list.slice(0, 3)]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismissLeft(id);
      }, duration);
    }
  }

  public dismissEmergency(): void {
    const current = this.emergencyAlert();
    if (current?.onConfirm) {
      current.onConfirm();
    }
    this.emergencyAlert.set(null);
  }

  public dismissTop(id: string): void {
    this.topAlerts.update(list => list.filter(a => a.id !== id));
  }

  public dismissLeft(id: string): void {
    this.leftToasts.update(list => list.filter(a => a.id !== id));
  }
}

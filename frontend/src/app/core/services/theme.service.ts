import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  public currentTheme = signal<AppTheme>('light');

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('qm_theme') as AppTheme;
      // Default to 'light' as requested
      const theme: AppTheme = saved === 'dark' ? 'dark' : 'light';
      this.setTheme(theme);
    }
  }

  public toggleTheme(): void {
    const next: AppTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  public setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-bs-theme', theme);
      document.body.classList.remove('light-theme', 'dark-theme');
      document.body.classList.add(`${theme}-theme`);
      localStorage.setItem('qm_theme', theme);
    }
  }

  public isLight(): boolean {
    return this.currentTheme() === 'light';
  }
}

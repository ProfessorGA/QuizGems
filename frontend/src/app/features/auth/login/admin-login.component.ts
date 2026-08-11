import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AdminApiService } from '../../../core/services/admin-api.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-wrapper d-flex align-items-center justify-content-center min-vh-100 px-3 py-4">
      <div class="login-card glass-card p-4 p-sm-5 w-100" style="max-width: 420px;">
        
        <!-- Brand Header -->
        <div class="text-center mb-4">
          <div class="admin-orb mx-auto mb-3">
            <i class="bi bi-shield-lock-fill"></i>
          </div>
          <h1 class="h3 fw-bold text-white mb-1">ADMIN LOGIN</h1>
          <p class="text-secondary small mb-0">Quiz Master Command Center</p>
        </div>

        <!-- Error alert -->
        <div *ngIf="errorMessage()" class="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-4 rounded-3 small">
          <i class="bi bi-exclamation-octagon-fill flex-shrink-0"></i>
          <div>{{ errorMessage() }}</div>
        </div>

        <form (ngSubmit)="onLogin()" #loginForm="ngForm" class="d-flex flex-column gap-3">
          
          <div>
            <label class="form-label text-light small fw-bold">USERNAME</label>
            <div class="input-group-custom">
              <span class="input-icon"><i class="bi bi-person-fill"></i></span>
              <input 
                type="text" 
                name="username" 
                [(ngModel)]="username" 
                required 
                placeholder="admin" 
                class="form-control-custom"
                [disabled]="isLoading()"
                autocomplete="username"
              />
            </div>
          </div>

          <div>
            <label class="form-label text-light small fw-bold">PASSWORD</label>
            <div class="input-group-custom">
              <span class="input-icon"><i class="bi bi-key-fill"></i></span>
              <input 
                type="password" 
                name="password" 
                [(ngModel)]="password" 
                required 
                placeholder="••••••••" 
                class="form-control-custom"
                [disabled]="isLoading()"
                autocomplete="current-password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            class="btn-admin-submit w-100 py-3 mt-3 fw-bold text-uppercase tracking-wider"
            [disabled]="isLoading() || !username || !password"
          >
            <span *ngIf="!isLoading()">
              <i class="bi bi-box-arrow-in-right me-2"></i>LOG IN
            </span>
            <span *ngIf="isLoading()" class="d-flex align-items-center justify-content-center gap-2">
              <span class="spinner-border spinner-border-sm"></span>
              AUTHENTICATING...
            </span>
          </button>
        </form>

        <div class="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
          <a routerLink="/join" class="text-secondary text-decoration-none small hover-link">
            <i class="bi bi-arrow-left me-1"></i>Back to Participant Join
          </a>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      background: radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.15), transparent 70%),
                  radial-gradient(circle at 80% 80%, rgba(79, 70, 229, 0.1), transparent 60%),
                  #0b0f19;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.88);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15);
    }
    .admin-orb {
      width: 58px;
      height: 58px;
      border-radius: 16px;
      background: linear-gradient(135deg, #4f46e5, #3730a3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.7rem;
      color: #fff;
      box-shadow: 0 0 20px rgba(79, 70, 229, 0.5);
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
      border-color: #818cf8;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .btn-admin-submit {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      border: none;
      border-radius: 12px;
      color: #ffffff;
      font-size: 1.05rem;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(79, 70, 229, 0.35);
      transition: all 0.25s ease;
    }
    .btn-admin-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(79, 70, 229, 0.5);
    }
    .btn-admin-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .hover-link:hover {
      color: #818cf8 !important;
    }
  `]
})
export class AdminLoginComponent {
  public username: string = '';
  public password: string = '';
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string>('');

  constructor(
    private adminApi: AdminApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  public onLogin(): void {
    if (!this.username.trim() || !this.password.trim()) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.adminApi.login({ username: this.username.trim(), password: this.password }).subscribe({
      next: (res) => {
        sessionStorage.setItem('qm_admin_token', res.token);
        sessionStorage.setItem('qm_admin_user', res.username);
        // Clear any old local storage tokens
        localStorage.removeItem('qm_admin_token');
        localStorage.removeItem('qm_admin_user');
        this.isLoading.set(false);

        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/sessions';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Invalid username or password.');
      }
    });
  }
}

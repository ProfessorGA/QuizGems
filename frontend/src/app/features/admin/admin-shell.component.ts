import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-layout min-vh-100 d-flex flex-column">
      
      <!-- Admin Top Navigation -->
      <nav class="admin-navbar py-2 px-3 px-md-4 d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
          <a routerLink="/admin/sessions" class="admin-brand text-decoration-none d-flex align-items-center gap-2">
            <div class="admin-badge-icon">
              <i class="bi bi-shield-lock-fill"></i>
            </div>
            <div>
              <span class="admin-brand-title">QUIZ MASTER</span>
              <span class="admin-brand-sub d-block">ADMIN COMMAND CENTER</span>
            </div>
          </a>
        </div>

        <div class="d-flex align-items-center gap-2">
          <span class="text-secondary small d-none d-sm-inline">
            Logged in as <strong class="text-white">{{ username }}</strong>
          </span>
          <button class="btn btn-outline-secondary btn-sm px-3 py-1 rounded-3 ms-2" (click)="logout()">
            <i class="bi bi-box-arrow-right me-1"></i>Logout
          </button>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="flex-grow-1">
        <router-outlet></router-outlet>
      </main>

      <!-- Footer -->
      <footer class="admin-footer py-2 px-4 text-center border-top border-secondary border-opacity-25">
        <span class="text-secondary small">
          Quiz Master Physical Room Competition Platform • v1.0.0
        </span>
      </footer>

    </div>
  `,
  styles: [`
    .admin-layout {
      background-color: #0b0f19;
      color: #f8fafc;
    }
    .admin-navbar {
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
    }
    .admin-badge-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4f46e5, #3730a3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 1.1rem;
      box-shadow: 0 0 12px rgba(79, 70, 229, 0.4);
    }
    .admin-brand-title {
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #ffffff;
      font-family: 'Outfit', sans-serif;
    }
    .admin-brand-sub {
      font-size: 0.6rem;
      font-weight: 700;
      color: #818cf8;
      letter-spacing: 0.1em;
    }
    .admin-footer {
      background: rgba(11, 15, 25, 0.9);
    }
  `]
})
export class AdminShellComponent {
  public username: string = '';

  constructor(private router: Router) {
    this.username = localStorage.getItem('qm_admin_user') || 'Admin';
  }

  public logout(): void {
    localStorage.removeItem('qm_admin_token');
    localStorage.removeItem('qm_admin_user');
    this.router.navigate(['/admin/login']);
  }
}

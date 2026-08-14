import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AlertContainerComponent } from './shared/components/alert-container/alert-container.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, AlertContainerComponent],
  template: `
    <div class="app-layout d-flex flex-column min-vh-100 justify-content-between">
      <app-alert-container></app-alert-container>
      <div class="flex-grow-1">
        <app-navbar></app-navbar>
        <main>
          <router-outlet></router-outlet>
        </main>
      </div>
      
      <!-- Official Copyright Footer -->
      <footer class="app-footer py-3">
        <div class="container text-center">
          <p class="mb-0 small text-theme-secondary">
            © 2026 GEMS. Developed this project for fun purposes only.
          </p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
    .app-layout {
      min-height: 100vh;
    }
  `]
})
export class AppComponent {
  constructor(public theme: ThemeService) {}
}

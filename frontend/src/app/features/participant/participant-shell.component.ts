import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-participant-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <main class="participant-shell">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .participant-shell {
      min-height: 100vh;
      background-color: #0b0f19;
      color: #f8fafc;
    }
  `]
})
export class ParticipantShellComponent {}

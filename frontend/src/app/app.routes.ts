import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/guards/admin-auth.guard';
import { participantGuard } from './core/guards/participant.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'join',
    pathMatch: 'full'
  },
  {
    path: 'join',
    loadComponent: () => import('./features/participant/join/participant-join.component').then(m => m.ParticipantJoinComponent)
  },
  {
    path: 'participant',
    loadComponent: () => import('./features/participant/participant-shell.component').then(m => m.ParticipantShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'waiting',
        pathMatch: 'full'
      },
      {
        path: 'waiting',
        canActivate: [participantGuard],
        loadComponent: () => import('./features/participant/waiting/participant-waiting.component').then(m => m.ParticipantWaitingComponent)
      },
      {
        path: 'voting',
        canActivate: [participantGuard],
        loadComponent: () => import('./features/participant/voting/participant-voting.component').then(m => m.ParticipantVotingComponent)
      },
      {
        path: 'submitted',
        canActivate: [participantGuard],
        loadComponent: () => import('./features/participant/submitted/participant-submitted.component').then(m => m.ParticipantSubmittedComponent)
      },
      {
        path: 'result',
        canActivate: [participantGuard],
        loadComponent: () => import('./features/participant/result/participant-result.component').then(m => m.ParticipantResultComponent)
      }
    ]
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./features/auth/login/admin-login.component').then(m => m.AdminLoginComponent)
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./features/admin/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'sessions',
        pathMatch: 'full'
      },
      {
        path: 'sessions',
        loadComponent: () => import('./features/admin/sessions/session-list.component').then(m => m.SessionListComponent)
      },
      {
        path: 'sessions/:id',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'join'
  }
];

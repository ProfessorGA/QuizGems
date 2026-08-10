import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { QuizStateService } from '../services/quiz-state.service';

export const participantGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const state = inject(QuizStateService);

  const code = route.queryParams['code'] || route.queryParams['sessionCode'];
  const id = route.queryParams['id'] || route.queryParams['participantId'];
  const participant = localStorage.getItem('qm_participant');

  if (code && id) {
    state.syncWithServerState(code, id);
    return true;
  }

  if (participant) {
    return true;
  }

  router.navigate(['/join']);
  return false;
};

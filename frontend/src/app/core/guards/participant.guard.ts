import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const participantGuard: CanActivateFn = () => {
  const router = inject(Router);
  const participant = localStorage.getItem('qm_participant');

  if (participant) {
    return true;
  }

  router.navigate(['/join']);
  return false;
};

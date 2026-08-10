import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('qm_admin_token');

  if (token) {
    return true;
  }

  router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

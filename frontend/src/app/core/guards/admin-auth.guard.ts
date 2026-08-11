import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';

export const adminAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = sessionStorage.getItem('qm_admin_token');

  if (!token) {
    sessionStorage.removeItem('qm_admin_token');
    sessionStorage.removeItem('qm_admin_user');
    localStorage.removeItem('qm_admin_token');
    localStorage.removeItem('qm_admin_user');
    router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem('qm_admin_token');
        sessionStorage.removeItem('qm_admin_user');
        router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url, expired: true } });
        return false;
      }
      return true;
    }
  } catch {
    sessionStorage.removeItem('qm_admin_token');
    sessionStorage.removeItem('qm_admin_user');
    router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return true;
};

export const adminAuthChildGuard: CanActivateChildFn = (childRoute, state) => {
  return adminAuthGuard(childRoute, state);
};

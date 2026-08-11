import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('qm_admin_token');

  let requestToForward = req;

  if (token && req.url.includes('/admin') && !req.url.includes('/auth/login')) {
    requestToForward = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(requestToForward).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized or 403 Forbidden is returned from admin API
      if ((error.status === 401 || error.status === 403) && req.url.includes('/admin') && !req.url.includes('/auth/login')) {
        localStorage.removeItem('qm_admin_token');
        localStorage.removeItem('qm_admin_user');
        router.navigate(['/admin/login'], { queryParams: { returnUrl: router.url, unauthorized: true } });
      }
      return throwError(() => error);
    })
  );
};

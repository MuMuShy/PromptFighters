import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { of, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isTokenValid()) {
    return true;
  }

  // If access token is expired, try to refresh it
  if (authService.getRefreshToken()) {
    return authService.refreshToken().pipe(
      map(response => {
        // If refresh is successful, response will have an access token
        return !!response.access;
      }),
      catchError(() => {
        // If refresh fails, redirect to login
        router.navigate(['/login']);
        return of(false);
      })
    );
  }

  // No refresh token, definitely not logged in
  router.navigate(['/login']);
  return false;
}; 
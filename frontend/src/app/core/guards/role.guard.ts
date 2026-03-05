import { inject }              from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService }          from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn())
    return router.createUrlTree(['/auth/login']);

  if (auth.hasRole(...allowedRoles)) return true;

  // Authenticated but insufficient role
  return router.createUrlTree(['/dashboard']);
};

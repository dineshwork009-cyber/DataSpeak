import {
  HttpInterceptorFn, HttpRequest, HttpHandlerFn,
  HttpEvent, HttpErrorResponse
} from '@angular/common/http';
import { inject }           from '@angular/core';
import { Observable, throwError, switchMap, catchError } from 'rxjs';
import { AuthService }      from '../services/auth.service';
import { Router }           from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const auth   = inject(AuthService);
  const router = inject(Router);

  // Skip auth header for auth endpoints
  if (req.url.includes('/auth/login') ||
      req.url.includes('/auth/register') ||
      req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        // Try to refresh the token
        return auth.refresh().pipe(
          switchMap(newAuth => {
            if (!newAuth) {
              router.navigate(['/auth/login']);
              return throwError(() => err);
            }
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newAuth.accessToken}` }
            });
            return next(retryReq);
          }),
          catchError(() => {
            router.navigate(['/auth/login']);
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};

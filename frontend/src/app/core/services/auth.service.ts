import { Injectable, signal, computed }    from '@angular/core';
import { HttpClient }                       from '@angular/common/http';
import { Router }                           from '@angular/router';
import { Observable, tap, catchError, of }  from 'rxjs';
import { environment }                      from '../../../environments/environment';
import {
  AuthResponse, LoginRequest, RegisterRequest, UserProfile
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // ── Reactive state ──────────────────────────────────────────
  private readonly _user   = signal<UserProfile | null>(this.loadUser());
  private readonly _token  = signal<string | null>(this.loadToken());

  readonly user        = this._user.asReadonly();
  readonly isLoggedIn  = computed(() => this._token() !== null);
  readonly userRole    = computed(() => this._user()?.role ?? null);

  constructor(private http: HttpClient, private router: Router) {}

  // ── Login ───────────────────────────────────────────────────
  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, req).pipe(
      tap(r => this.storeSession(r))
    );
  }

  // ── Register ────────────────────────────────────────────────
  register(req: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, req).pipe(
      tap(r => this.storeSession(r))
    );
  }

  // ── Refresh ─────────────────────────────────────────────────
  refresh(): Observable<AuthResponse | null> {
    const accessToken  = this._token();
    const refreshToken = localStorage.getItem('refresh_token');

    if (!accessToken || !refreshToken) return of(null);

    return this.http
      .post<AuthResponse>(`${this.apiUrl}/refresh`, { accessToken, refreshToken })
      .pipe(
        tap(r => this.storeSession(r)),
        catchError(() => { this.logout(); return of(null); })
      );
  }

  // ── Logout ──────────────────────────────────────────────────
  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}).pipe(catchError(() => of(null))).subscribe();
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  // ── Token accessors ─────────────────────────────────────────
  getAccessToken(): string | null {
    return this._token();
  }

  hasRole(...roles: string[]): boolean {
    const role = this._user()?.role;
    return role ? roles.includes(role) : false;
  }

  // ── Helpers ─────────────────────────────────────────────────
  private storeSession(auth: AuthResponse): void {
    localStorage.setItem('access_token',  auth.accessToken);
    localStorage.setItem('refresh_token', auth.refreshToken);
    localStorage.setItem('user_profile',  JSON.stringify(auth.user));
    this._token.set(auth.accessToken);
    this._user.set(auth.user);
  }

  private clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    this._token.set(null);
    this._user.set(null);
  }

  private loadToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private loadUser(): UserProfile | null {
    const raw = localStorage.getItem('user_profile');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
}

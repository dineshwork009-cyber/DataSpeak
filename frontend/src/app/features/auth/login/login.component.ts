import { Component, signal }      from '@angular/core';
import { CommonModule }            from '@angular/common';
import { Router, RouterLink }      from '@angular/router';
import {
  FormBuilder, ReactiveFormsModule, Validators
} from '@angular/forms';
import { MatFormFieldModule }      from '@angular/material/form-field';
import { MatInputModule }          from '@angular/material/input';
import { MatButtonModule }         from '@angular/material/button';
import { MatIconModule }           from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService }             from '../../../core/services/auth.service';
import { NotificationService }     from '../../../core/services/notification.service';

@Component({
  selector:   'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="auth-page">

      <!-- Left panel -->
      <div class="left-panel">
        <div class="brand">
          <div class="brand-icon">
            <mat-icon>auto_awesome</mat-icon>
          </div>
          <span class="brand-name">DataSpeak</span>
        </div>

        <div class="hero-text">
          <h2>Talk to your data<br>in plain English</h2>
          <p>Connect any database, ask questions naturally,<br>get instant SQL-powered answers.</p>
        </div>

        <div class="features">
          @for (f of features; track f.icon) {
            <div class="feature-item">
              <mat-icon class="f-icon">{{ f.icon }}</mat-icon>
              <span>{{ f.text }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Right panel -->
      <div class="right-panel">
        <div class="form-card">

          <div class="form-header">
            <h1>Welcome back</h1>
            <p>Sign in to your account to continue</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">

            <div class="field-group">
              <label>Email address</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput type="email" formControlName="email"
                       placeholder="you@company.com"
                       autocomplete="email" />
                <mat-icon matPrefix>mail_outline</mat-icon>
                @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
                @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                  <mat-error>Enter a valid email</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="field-group">
              <label>Password</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput [type]="showPwd() ? 'text' : 'password'"
                       formControlName="password"
                       placeholder="••••••••"
                       autocomplete="current-password" />
                <mat-icon matPrefix>lock_outline</mat-icon>
                <button mat-icon-button matSuffix type="button"
                        (click)="showPwd.set(!showPwd())">
                  <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                  <mat-error>Password is required</mat-error>
                }
              </mat-form-field>
            </div>

            <button mat-raised-button class="submit-btn"
                    type="submit"
                    [disabled]="form.invalid || loading()">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                Sign in
              }
            </button>

          </form>

          <p class="register-link">
            New to DataSpeak? <a routerLink="/auth/register">Create an account</a>
          </p>

        </div>
      </div>

    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
    }

    /* ── Left panel ─────────────────────────────────────── */
    .left-panel {
      flex: 1;
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #1a1f3a 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px;
      color: white;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 64px;
    }
    .brand-icon {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-icon mat-icon { color: white; font-size: 24px; }
    .brand-name {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .hero-text h2 {
      font-size: 2.25rem;
      font-weight: 700;
      line-height: 1.25;
      margin: 0 0 16px;
      background: linear-gradient(135deg, #fff 60%, #a5b4fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-text p {
      font-size: 1rem;
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 48px;
    }

    .features { display: flex; flex-direction: column; gap: 16px; }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #cbd5e1;
      font-size: 0.9rem;
    }
    .f-icon {
      width: 36px; height: 36px;
      background: rgba(99,102,241,0.15);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #818cf8;
      font-size: 18px;
      line-height: 36px;
      text-align: center;
    }

    /* ── Right panel ─────────────────────────────────────── */
    .right-panel {
      width: 480px;
      min-width: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      padding: 40px;
    }

    .form-card {
      width: 100%;
      max-width: 400px;
    }

    .form-header {
      margin-bottom: 32px;
    }
    .form-header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 8px;
      color: #0f172a;
    }
    .form-header p {
      color: #64748b;
      margin: 0;
      font-size: 0.9rem;
    }

    .field-group {
      margin-bottom: 20px;
    }
    .field-group label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    .full-width { width: 100%; }

    .submit-btn {
      width: 100%;
      height: 48px;
      font-size: 0.95rem;
      font-weight: 600;
      margin-top: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
      color: white !important;
      border-radius: 10px !important;
    }
    .submit-btn:disabled { opacity: 0.6; }

    .register-link {
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
      margin-top: 24px;
    }
    .register-link a {
      color: #6366f1;
      font-weight: 600;
      text-decoration: none;
    }
    .register-link a:hover { text-decoration: underline; }

    @media (max-width: 768px) {
      .left-panel { display: none; }
      .right-panel { width: 100%; min-width: unset; }
    }
  `]
})
export class LoginComponent {
  form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  readonly loading = signal(false);
  readonly showPwd = signal(false);

  readonly features = [
    { icon: 'translate',     text: 'Natural language to SQL automatically' },
    { icon: 'storage',       text: 'Connect PostgreSQL, MySQL, SQL Server' },
    { icon: 'security',      text: 'Read-only queries — your data stays safe' },
    { icon: 'bar_chart',     text: 'Instant results with smart data tables' }
  ];

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private notify: NotificationService,
    private router: Router
  ) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);

    this.auth.login(this.form.getRawValue()).subscribe({
      next:     () => this.router.navigate(['/dashboard']),
      error:    (err) => {
        this.loading.set(false);
        this.notify.error(err?.error?.title ?? 'Login failed. Please check your credentials.');
      },
      complete: () => this.loading.set(false)
    });
  }
}

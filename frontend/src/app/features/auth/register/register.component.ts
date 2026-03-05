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
  selector:   'app-register',
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
          <h2>Get started in<br>minutes</h2>
          <p>Set up your organisation, connect a database,<br>and start querying in plain English right away.</p>
        </div>

        <div class="steps">
          @for (s of steps; track s.num) {
            <div class="step-item">
              <div class="step-num">{{ s.num }}</div>
              <span>{{ s.text }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Right panel -->
      <div class="right-panel">
        <div class="form-card">

          <div class="form-header">
            <h1>Create your account</h1>
            <p>Start your free DataSpeak workspace</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">

            <!-- Org name -->
            <div class="field-group">
              <label>Organisation name</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput formControlName="tenantName" placeholder="Acme Corp" />
                <mat-icon matPrefix>business</mat-icon>
                @if (f['tenantName'].invalid && f['tenantName'].touched) {
                  <mat-error>Organisation name is required</mat-error>
                }
              </mat-form-field>
            </div>

            <!-- Name row -->
            <div class="name-row">
              <div class="field-group">
                <label>First name</label>
                <mat-form-field appearance="outline" class="full-width">
                  <input matInput formControlName="firstName" placeholder="Jane" />
                  @if (f['firstName'].invalid && f['firstName'].touched) {
                    <mat-error>Required</mat-error>
                  }
                </mat-form-field>
              </div>
              <div class="field-group">
                <label>Last name</label>
                <mat-form-field appearance="outline" class="full-width">
                  <input matInput formControlName="lastName" placeholder="Smith" />
                  @if (f['lastName'].invalid && f['lastName'].touched) {
                    <mat-error>Required</mat-error>
                  }
                </mat-form-field>
              </div>
            </div>

            <!-- Email -->
            <div class="field-group">
              <label>Work email</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput type="email" formControlName="email"
                       placeholder="jane@company.com" autocomplete="email" />
                <mat-icon matPrefix>mail_outline</mat-icon>
                @if (f['email'].invalid && f['email'].touched) {
                  <mat-error>Valid email is required</mat-error>
                }
              </mat-form-field>
            </div>

            <!-- Password -->
            <div class="field-group">
              <label>Password</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput [type]="showPwd() ? 'text' : 'password'"
                       formControlName="password"
                       placeholder="Min. 8 characters"
                       autocomplete="new-password" />
                <mat-icon matPrefix>lock_outline</mat-icon>
                <button mat-icon-button matSuffix type="button"
                        (click)="showPwd.set(!showPwd())">
                  <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (f['password'].hasError('minlength') && f['password'].touched) {
                  <mat-error>At least 8 characters required</mat-error>
                }
              </mat-form-field>
            </div>

            <button mat-raised-button class="submit-btn"
                    type="submit"
                    [disabled]="form.invalid || loading()">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                Create account
              }
            </button>

          </form>

          <p class="login-link">
            Already have an account? <a routerLink="/auth/login">Sign in</a>
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
    .brand-name { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }

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

    .steps { display: flex; flex-direction: column; gap: 20px; }
    .step-item {
      display: flex;
      align-items: center;
      gap: 16px;
      color: #cbd5e1;
      font-size: 0.9rem;
    }
    .step-num {
      width: 28px; height: 28px;
      background: rgba(99,102,241,0.25);
      border: 1px solid rgba(99,102,241,0.5);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #a5b4fc;
      flex-shrink: 0;
    }

    .right-panel {
      width: 520px;
      min-width: 520px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      padding: 40px;
    }

    .form-card { width: 100%; max-width: 440px; }

    .form-header { margin-bottom: 28px; }
    .form-header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 8px;
      color: #0f172a;
    }
    .form-header p { color: #64748b; margin: 0; font-size: 0.9rem; }

    .field-group { margin-bottom: 16px; }
    .field-group label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    .full-width { width: 100%; }

    .name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

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

    .login-link {
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
      margin-top: 24px;
    }
    .login-link a {
      color: #6366f1;
      font-weight: 600;
      text-decoration: none;
    }
    .login-link a:hover { text-decoration: underline; }

    @media (max-width: 768px) {
      .left-panel { display: none; }
      .right-panel { width: 100%; min-width: unset; }
    }
  `]
})
export class RegisterComponent {
  form = this.fb.nonNullable.group({
    tenantName: ['', [Validators.required, Validators.maxLength(100)]],
    firstName:  ['', [Validators.required, Validators.maxLength(50)]],
    lastName:   ['', [Validators.required, Validators.maxLength(50)]],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(8)]]
  });

  readonly loading = signal(false);
  readonly showPwd = signal(false);

  readonly steps = [
    { num: 1, text: 'Create your organisation' },
    { num: 2, text: 'Connect your database' },
    { num: 3, text: 'Start asking questions in plain English' }
  ];

  get f() { return this.form.controls; }

  constructor(
    private fb:     FormBuilder,
    private auth:   AuthService,
    private notify: NotificationService,
    private router: Router
  ) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);

    this.auth.register(this.form.getRawValue()).subscribe({
      next:     () => this.router.navigate(['/dashboard']),
      error:    (err) => {
        this.loading.set(false);
        this.notify.error(err?.error?.title ?? 'Registration failed. Please try again.');
      },
      complete: () => this.loading.set(false)
    });
  }
}

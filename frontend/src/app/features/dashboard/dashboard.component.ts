import { Component, OnInit, signal } from '@angular/core';
import { CommonModule }               from '@angular/common';
import { RouterLink }                 from '@angular/router';
import { HttpClient }                 from '@angular/common/http';
import { MatIconModule }              from '@angular/material/icon';
import { MatButtonModule }            from '@angular/material/button';
import { MatProgressSpinnerModule }   from '@angular/material/progress-spinner';
import { AuthService }                from '../../core/services/auth.service';
import { ConnectionService }          from '../../core/services/connection.service';
import { environment }                from '../../../environments/environment';

interface DashboardStats {
  totalConnections:    number;
  totalQueriesMonth:   number;
  totalTokensMonth:    number;
  successRate:         number;
}

@Component({
  selector:   'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="page">

      <!-- ── Top bar ───────────────────────────────── -->
      <div class="topbar">
        <div class="topbar-left">
          <div class="greeting">Good {{ timeOfDay() }}, {{ user()?.firstName }}!</div>
          <div class="org-pill">
            <mat-icon>business</mat-icon>
            {{ user()?.tenantName }}
            <span class="role-badge">{{ user()?.role }}</span>
          </div>
        </div>
        <button class="new-query-btn" routerLink="/query">
          <mat-icon>chat_bubble_outline</mat-icon>
          New Query
        </button>
      </div>

      @if (loading()) {
        <div class="loading-wrap">
          <mat-spinner diameter="40" />
        </div>
      } @else {

        <!-- ── Stats ─────────────────────────────────── -->
        <div class="stats-grid">
          @for (s of statCards(); track s.label) {
            <div class="stat-card">
              <div class="stat-icon-wrap" [class]="s.color">
                <mat-icon>{{ s.icon }}</mat-icon>
              </div>
              <div class="stat-body">
                <div class="stat-value">{{ s.value }}</div>
                <div class="stat-label">{{ s.label }}</div>
              </div>
            </div>
          }
        </div>

        <!-- ── Quick actions ──────────────────────────── -->
        <div class="section-title">Quick Actions</div>
        <div class="actions-grid">
          @for (a of actions; track a.route) {
            <a class="action-card" [routerLink]="a.route">
              <div class="action-icon" [class]="a.color">
                <mat-icon>{{ a.icon }}</mat-icon>
              </div>
              <div class="action-body">
                <div class="action-title">{{ a.title }}</div>
                <div class="action-desc">{{ a.desc }}</div>
              </div>
              <mat-icon class="action-arrow">chevron_right</mat-icon>
            </a>
          }
        </div>

      }
    </div>
  `,
  styles: [`
    .page {
      padding: 32px;
      max-width: 1100px;
      margin: 0 auto;
    }

    /* Topbar */
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }
    .greeting {
      font-size: 1.6rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .org-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 4px 12px 4px 8px;
      font-size: 0.8rem;
      color: #475569;
    }
    .org-pill mat-icon { font-size: 16px; color: #6366f1; }
    .role-badge {
      background: rgba(99,102,241,0.1);
      color: #6366f1;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .new-query-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px 20px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.2s;
    }
    .new-query-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .new-query-btn mat-icon { font-size: 20px; }

    .loading-wrap {
      display: flex;
      justify-content: center;
      padding: 80px;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: white;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .stat-icon-wrap {
      width: 48px; height: 48px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .stat-icon-wrap mat-icon { font-size: 24px; color: white; }
    .stat-icon-wrap.purple  { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
    .stat-icon-wrap.blue    { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
    .stat-icon-wrap.amber   { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
    .stat-icon-wrap.green   { background: linear-gradient(135deg, #10b981, #34d399); }

    .stat-value { font-size: 1.75rem; font-weight: 700; color: #0f172a; }
    .stat-label { font-size: 0.8rem; color: #64748b; margin-top: 2px; }

    /* Quick actions */
    .section-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .actions-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      cursor: pointer;
    }
    .action-card:hover {
      border-color: #c7d2fe;
      box-shadow: 0 4px 12px rgba(99,102,241,0.08);
      transform: translateX(2px);
    }
    .action-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .action-icon mat-icon { font-size: 20px; color: white; }
    .action-icon.purple { background: rgba(99,102,241,0.12); }
    .action-icon.purple mat-icon { color: #6366f1; }
    .action-icon.blue   { background: rgba(14,165,233,0.12); }
    .action-icon.blue mat-icon   { color: #0ea5e9; }
    .action-icon.green  { background: rgba(16,185,129,0.12); }
    .action-icon.green mat-icon  { color: #10b981; }

    .action-body { flex: 1; }
    .action-title { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
    .action-desc  { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
    .action-arrow { color: #cbd5e1; font-size: 20px; }
  `]
})
export class DashboardComponent implements OnInit {
  readonly user    = this.authService.user;
  readonly loading = signal(true);
  readonly stats   = signal<DashboardStats | null>(null);

  readonly statCards = () => {
    const s = this.stats();
    return [
      { icon: 'storage',      color: 'purple', label: 'Connections',        value: s?.totalConnections ?? 0 },
      { icon: 'query_stats',  color: 'blue',   label: 'Queries this month', value: s?.totalQueriesMonth ?? 0 },
      { icon: 'token',        color: 'amber',  label: 'Tokens used',        value: this.fmt(s?.totalTokensMonth ?? 0) },
      { icon: 'check_circle', color: 'green',  label: 'Success rate',       value: (s?.successRate ?? 100) + '%' }
    ];
  };

  readonly actions = [
    { icon: 'chat_bubble_outline', color: 'purple', route: '/query',
      title: 'Query in Natural Language',
      desc:  'Ask questions about your data in plain English' },
    { icon: 'storage', color: 'blue', route: '/connections',
      title: 'Manage Connections',
      desc:  'Add, test or remove database connections' },
    { icon: 'history', color: 'green', route: '/query/history',
      title: 'Query History',
      desc:  'Browse your past queries and their results' }
  ];

  constructor(
    private authService: AuthService,
    private connService: ConnectionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const now = new Date();

    // Load connections count + usage in parallel
    Promise.all([
      this.connService.getAll().toPromise().catch(() => []),
      this.http.get<any[]>(
        `${environment.apiUrl}/tenants/current/usage?month=${now.getMonth()+1}&year=${now.getFullYear()}`
      ).toPromise().catch(() => [])
    ]).then(([conns, usageItems]) => {
      const items: any[] = Array.isArray(usageItems) ? usageItems : [];
      const total   = items.reduce((s: number, r: any) => s + (r.totalQueries ?? 0), 0);
      const success = items.reduce((s: number, r: any) => s + (r.successfulQueries ?? 0), 0);

      this.stats.set({
        totalConnections:  (conns as any[]).length,
        totalQueriesMonth: total,
        totalTokensMonth:  items.reduce((s: number, r: any) => s + (r.totalTokensUsed ?? 0), 0),
        successRate:       total > 0 ? Math.round((success / total) * 100) : 100
      });
      this.loading.set(false);
    });
  }

  timeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  private fmt(n: number): string {
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }
}

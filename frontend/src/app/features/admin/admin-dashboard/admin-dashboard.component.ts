import { Component, OnInit, signal } from '@angular/core';
import { CommonModule }              from '@angular/common';
import { HttpClient }                from '@angular/common/http';
import { MatCardModule }             from '@angular/material/card';
import { MatTableModule }            from '@angular/material/table';
import { MatChipsModule }            from '@angular/material/chips';
import { MatIconModule }             from '@angular/material/icon';
import { MatButtonModule }           from '@angular/material/button';
import { MatProgressSpinnerModule }  from '@angular/material/progress-spinner';
import { NotificationService }       from '../../../core/services/notification.service';
import { environment }               from '../../../../environments/environment';

@Component({
  selector:   'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatTableModule, MatChipsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Platform Admin</h1>
        <p class="subtitle">Organisation and usage overview</p>
      </div>

      @if (statsLoading()) {
        <mat-spinner diameter="40" class="center-spinner" />
      } @else if (stats()) {
        <div class="stats-grid">
          <mat-card class="stat-card">
            <mat-card-content>
              <mat-icon>business</mat-icon>
              <div class="stat-value">{{ stats()!.totalTenants }}</div>
              <div class="stat-label">Organisations</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="stat-card">
            <mat-card-content>
              <mat-icon>people</mat-icon>
              <div class="stat-value">{{ stats()!.totalUsers }}</div>
              <div class="stat-label">Total Users</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="stat-card">
            <mat-card-content>
              <mat-icon>query_stats</mat-icon>
              <div class="stat-value">{{ stats()!.totalQueries | number }}</div>
              <div class="stat-label">Total Queries</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="stat-card">
            <mat-card-content>
              <mat-icon>token</mat-icon>
              <div class="stat-value">{{ stats()!.totalTokens | number }}</div>
              <div class="stat-label">Total Tokens</div>
            </mat-card-content>
          </mat-card>
        </div>
      }

      <mat-card class="tenants-table">
        <mat-card-header>
          <mat-card-title>All Organisations</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (tenantsLoading()) {
            <div class="center-spinner"><mat-spinner diameter="32" /></div>
          } @else {
            <table mat-table [dataSource]="tenants()">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let row">{{ row.name }}</td>
              </ng-container>
              <ng-container matColumnDef="plan">
                <th mat-header-cell *matHeaderCellDef>Plan</th>
                <td mat-cell *matCellDef="let row"><mat-chip>{{ row.plan }}</mat-chip></td>
              </ng-container>
              <ng-container matColumnDef="userCount">
                <th mat-header-cell *matHeaderCellDef>Users</th>
                <td mat-cell *matCellDef="let row">{{ row.userCount }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class]="row.isActive ? 'active' : 'inactive'">
                    {{ row.isActive ? 'Active' : 'Suspended' }}
                  </mat-chip>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button (click)="toggleTenantStatus(row)">
                    {{ row.isActive ? 'Suspend' : 'Activate' }}
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { padding: 32px; max-width: 1400px; margin: 0 auto; }
    h1 { margin: 0; font-size: 1.75rem; font-weight: 700; }
    .subtitle { color: #64748b; margin: 4px 0; }
    .center-spinner { display: flex; justify-content: center; padding: 32px; }
    .stats-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0;
    }
    .stat-card mat-card-content {
      display: flex; flex-direction: column; align-items: center; padding: 24px;
    }
    .stat-card mat-icon { font-size: 36px; color: #6366f1; margin-bottom: 8px; }
    .stat-value { font-size: 2rem; font-weight: 700; }
    .stat-label { color: #64748b; }
    .tenants-table { border-radius: 12px !important; }
    table { width: 100%; }
    .active   { --mdc-chip-elevated-container-color: #d1fae5; }
    .inactive { --mdc-chip-elevated-container-color: #fee2e2; }
  `]
})
export class AdminDashboardComponent implements OnInit {
  readonly displayedColumns = ['name', 'plan', 'userCount', 'status', 'actions'];
  readonly statsLoading   = signal(true);
  readonly tenantsLoading = signal(true);
  readonly stats          = signal<any>(null);
  readonly tenants        = signal<any[]>([]);

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit(): void {
    this.http.get(`${environment.apiUrl}/admin/stats`).subscribe({
      next:  s  => { this.stats.set(s); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false)
    });

    this.http.get<any[]>(`${environment.apiUrl}/admin/tenants`).subscribe({
      next:  t  => { this.tenants.set(t); this.tenantsLoading.set(false); },
      error: () => this.tenantsLoading.set(false)
    });
  }

  toggleTenantStatus(tenant: any): void {
    const action = tenant.isActive ? 'suspend' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${tenant.name}?`)) return;

    this.http.put(`${environment.apiUrl}/admin/tenants/${tenant.id}/status`, {
      isActive: !tenant.isActive
    }).subscribe({
      next:  () => {
        this.tenants.update(list =>
          list.map(t => t.id === tenant.id ? { ...t, isActive: !t.isActive } : t)
        );
        this.notify.success(`Tenant ${action}d.`);
      },
      error: () => this.notify.error('Action failed.')
    });
  }
}

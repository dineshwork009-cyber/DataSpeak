import { Component, OnInit, signal } from '@angular/core';
import { CommonModule }              from '@angular/common';
import { RouterLink }                from '@angular/router';
import { MatCardModule }             from '@angular/material/card';
import { MatButtonModule }           from '@angular/material/button';
import { MatIconModule }             from '@angular/material/icon';
import { MatChipsModule }            from '@angular/material/chips';
import { MatProgressSpinnerModule }  from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule }             from '@angular/material/menu';
import { ConnectionService }         from '../../../core/services/connection.service';
import { NotificationService }       from '../../../core/services/notification.service';
import { DatabaseConnection }        from '../../../core/models/connection.models';

@Component({
  selector:   'app-connection-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatDialogModule, MatMenuModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Database Connections</h1>
          <p class="subtitle">Manage your external database connections</p>
        </div>
        <button mat-raised-button color="primary" routerLink="new">
          <mat-icon>add</mat-icon> New Connection
        </button>
      </div>

      @if (loading()) {
        <div class="spinner-center"><mat-spinner diameter="40" /></div>
      } @else if (connections().length === 0) {
        <div class="empty-state">
          <mat-icon class="empty-icon">storage</mat-icon>
          <h3>No connections yet</h3>
          <p>Add your first database connection to get started</p>
          <button mat-raised-button color="primary" routerLink="new">
            Add Connection
          </button>
        </div>
      } @else {
        <div class="connections-grid">
          @for (conn of connections(); track conn.id) {
            <mat-card class="conn-card">
              <mat-card-header>
                <mat-icon mat-card-avatar [class]="'provider-icon ' + conn.provider.toLowerCase()">
                  {{ providerIcon(conn.provider) }}
                </mat-icon>
                <mat-card-title>{{ conn.name }}</mat-card-title>
                <mat-card-subtitle>{{ conn.provider }}</mat-card-subtitle>
                <button mat-icon-button [matMenuTriggerFor]="menu" class="menu-btn">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu>
                  <button mat-menu-item (click)="testConnection(conn)">
                    <mat-icon>wifi_tethering</mat-icon> Test Connection
                  </button>
                  <button mat-menu-item class="danger" (click)="deleteConnection(conn)">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
                </mat-menu>
              </mat-card-header>

              <mat-card-content>
                @if (conn.description) {
                  <p class="description">{{ conn.description }}</p>
                }
                <div class="conn-meta">
                  <mat-chip [class]="'status-' + conn.status.toLowerCase()">
                    {{ conn.status }}
                  </mat-chip>
                  @if (conn.lastTestedAt) {
                    <span class="tested-at">
                      Tested {{ conn.lastTestedAt | date:'short' }}
                    </span>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 32px; max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 32px;
    }
    h1 { margin: 0; font-size: 1.75rem; font-weight: 700; }
    .subtitle { color: #64748b; margin: 4px 0 0; }
    .spinner-center { display: flex; justify-content: center; padding: 40px; }

    .empty-state {
      text-align: center; padding: 80px 24px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .empty-icon { font-size: 64px; color: #cbd5e1; }

    .connections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .conn-card { border-radius: 12px !important; }
    .conn-card mat-card-header { position: relative; }
    .menu-btn { position: absolute; right: 0; top: 0; }

    .provider-icon { font-size: 36px; }
    .provider-icon.sqlserver  { color: #e74c3c; }
    .provider-icon.postgresql { color: #336791; }
    .provider-icon.mysql      { color: #4479a1; }

    .description { color: #64748b; font-size: 0.875rem; margin: 8px 0; }
    .conn-meta { display: flex; align-items: center; gap: 8px; }
    .tested-at { font-size: 0.75rem; color: #94a3b8; }

    .status-active   { --mdc-chip-elevated-container-color: #d1fae5; }
    .status-inactive { --mdc-chip-elevated-container-color: #f1f5f9; }
    .status-error    { --mdc-chip-elevated-container-color: #fee2e2; }

    .danger { color: #dc2626; }
  `]
})
export class ConnectionListComponent implements OnInit {
  readonly loading     = signal(true);
  readonly connections = signal<DatabaseConnection[]>([]);

  constructor(
    private connService: ConnectionService,
    private notify:      NotificationService
  ) {}

  ngOnInit(): void {
    this.loadConnections();
  }

  testConnection(conn: DatabaseConnection): void {
    this.notify.info(`Testing ${conn.name}...`);
    this.connService.test(conn.id).subscribe({
      next:  result => result.success
        ? this.notify.success(result.message)
        : this.notify.error(result.message),
      error: () => this.notify.error('Test failed.')
    });
  }

  deleteConnection(conn: DatabaseConnection): void {
    if (!confirm(`Delete "${conn.name}"? This cannot be undone.`)) return;
    this.connService.delete(conn.id).subscribe({
      next: () => {
        this.connections.update(list => list.filter(c => c.id !== conn.id));
        this.notify.success('Connection deleted.');
      },
      error: () => this.notify.error('Delete failed.')
    });
  }

  providerIcon(provider: string): string {
    return provider === 'MySQL' ? 'database' : 'storage';
  }

  private loadConnections(): void {
    this.connService.getAll().subscribe({
      next:  conns => { this.connections.set(conns); this.loading.set(false); },
      error: ()    => this.loading.set(false)
    });
  }
}

import { Component, computed, signal } from '@angular/core';
import { CommonModule }                from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule }              from '@angular/material/icon';
import { MatTooltipModule }           from '@angular/material/tooltip';
import { MatMenuModule }              from '@angular/material/menu';
import { MatButtonModule }            from '@angular/material/button';
import { MatDividerModule }           from '@angular/material/divider';
import { AuthService }                from '../core/services/auth.service';

interface NavItem {
  label:  string;
  icon:   string;
  route:  string;
  roles?: string[];
}

@Component({
  selector:   'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatTooltipModule, MatMenuModule,
    MatButtonModule, MatDividerModule
  ],
  template: `
    <div class="shell">

      <!-- ── Sidebar ─────────────────────────────────────── -->
      <aside class="sidebar">

        <!-- Logo -->
        <div class="logo-area">
          <div class="logo-icon-wrap">
            <mat-icon class="logo-icon">auto_awesome</mat-icon>
          </div>
          <span class="logo-text">DataSpeak</span>
        </div>

        <div class="sidebar-section-label">MENU</div>

        <!-- Nav Items -->
        <nav class="nav-list">
          @for (item of visibleItems(); track item.route) {
            <a class="nav-item"
               [routerLink]="item.route"
               routerLinkActive="nav-item--active"
               [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }">
              <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
              <span class="nav-label">{{ item.label }}</span>
            </a>
          }
        </nav>

        <!-- User Footer -->
        <div class="sidebar-footer">
          <mat-divider class="footer-divider" />
          <div class="user-row" [matMenuTriggerFor]="userMenu">
            <div class="avatar">
              {{ (user()?.firstName ?? 'U')[0].toUpperCase() }}
            </div>
            <div class="user-info">
              <span class="user-name">{{ user()?.firstName }} {{ user()?.lastName }}</span>
              <span class="user-role">{{ user()?.role }}</span>
            </div>
            <mat-icon class="chevron">expand_more</mat-icon>
          </div>

          <mat-menu #userMenu="matMenu" xPosition="after" yPosition="above">
            <button mat-menu-item disabled>
              <mat-icon>person</mat-icon>
              <span>{{ user()?.email }}</span>
            </button>
            <mat-divider />
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </div>

      </aside>

      <!-- ── Main ───────────────────────────────────────── -->
      <main class="main-content">
        <router-outlet />
      </main>

    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Sidebar ──────────────────────────────────────── */
    .sidebar {
      width: 256px;
      min-width: 256px;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      box-shadow: 2px 0 16px rgba(0,0,0,.25);
    }

    /* Logo */
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 20px 20px;
    }
    .logo-icon-wrap {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .logo-icon { color: white; font-size: 20px; line-height: 36px; }
    .logo-text {
      font-size: 1.2rem;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
    }

    /* Section label */
    .sidebar-section-label {
      font-size: 0.65rem;
      font-weight: 600;
      color: #475569;
      letter-spacing: 1.2px;
      padding: 8px 20px 4px;
      text-transform: uppercase;
    }

    /* Nav list */
    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 12px;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      cursor: pointer;
    }
    .nav-item:hover {
      background: rgba(255,255,255,0.06);
      color: #e2e8f0;
    }
    .nav-item--active {
      background: rgba(99,102,241,0.18) !important;
      color: #a5b4fc !important;
      position: relative;
    }
    .nav-item--active::before {
      content: '';
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%);
      width: 3px; height: 60%;
      background: #6366f1;
      border-radius: 0 2px 2px 0;
    }
    .nav-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }

    /* Footer */
    .sidebar-footer {
      padding: 0 12px 16px;
    }
    .footer-divider {
      border-color: rgba(255,255,255,0.07) !important;
      margin-bottom: 12px;
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .user-row:hover { background: rgba(255,255,255,0.06); }

    .avatar {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .user-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .user-name {
      font-size: 0.8rem;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-role {
      font-size: 0.7rem;
      color: #64748b;
    }
    .chevron { color: #475569; font-size: 18px; }

    /* ── Main content ─────────────────────────────────── */
    .main-content {
      flex: 1;
      overflow-y: auto;
      background: #f8fafc;
    }
  `]
})
export class ShellComponent {
  private readonly navItems: NavItem[] = [
    { label: 'Dashboard',   icon: 'dashboard',           route: '/dashboard'   },
    { label: 'Connections', icon: 'storage',              route: '/connections' },
    { label: 'Query Chat',  icon: 'chat_bubble_outline',  route: '/query'       },
    { label: 'History',     icon: 'history',              route: '/query/history' },
    { label: 'Admin',       icon: 'admin_panel_settings', route: '/admin',
      roles: ['Owner', 'Admin'] }
  ];

  readonly user = this.auth.user;

  readonly visibleItems = computed(() => {
    const role = this.user()?.role;
    return this.navItems.filter(i => !i.roles || (role && i.roles.includes(role)));
  });

  constructor(private auth: AuthService) {}

  logout(): void { this.auth.logout(); }
}

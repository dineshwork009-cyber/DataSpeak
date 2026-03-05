import { Routes }    from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // ── Public auth pages (no sidebar) ───────────────────────
  {
    path:         'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes)
  },

  // ── Authenticated shell (sidebar layout) ──────────────────
  {
    path:          '',
    canActivate:   [authGuard],
    loadComponent: () =>
      import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '',           redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path:          'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path:         'connections',
        loadChildren: () =>
          import('./features/connections/connections.routes').then(m => m.connectionRoutes)
      },
      {
        path:         'query',
        loadChildren: () =>
          import('./features/query/query.routes').then(m => m.queryRoutes)
      },
      {
        path:        'admin',
        canActivate: [() => roleGuard(['Owner', 'Admin'])],
        loadChildren: () =>
          import('./features/admin/admin.routes').then(m => m.adminRoutes)
      }
    ]
  },

  { path: '**', redirectTo: '' }
];

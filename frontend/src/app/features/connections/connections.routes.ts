import { Routes } from '@angular/router';

export const connectionRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./connection-list/connection-list.component').then(m => m.ConnectionListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./connection-form/connection-form.component').then(m => m.ConnectionFormComponent)
  }
];

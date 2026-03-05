import { Routes } from '@angular/router';

export const queryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./query-chat/query-chat.component').then(m => m.QueryChatComponent)
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./query-history/query-history.component').then(m => m.QueryHistoryComponent)
  }
];

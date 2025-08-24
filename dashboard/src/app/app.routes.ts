import { Routes } from '@angular/router';
import { authGuard, guildAccessGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing').then((feature) => feature.Landing),
    pathMatch: 'full',
  },
  {
    path: 'servers',
    loadComponent: () =>
      import('./features/servers/servers.component').then((feature) => feature.ServersComponent),
    canActivate: [authGuard],
  },
  {
    path: 'servers/:serverId',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((feature) => feature.Dashboard),
    canActivate: [authGuard, guildAccessGuard],
  },
  // Legacy redirect for backward compatibility
  {
    path: 'guilds',
    redirectTo: 'servers',
  },
  {
    path: 'guilds/:guildId',
    redirectTo: 'servers/:guildId',
  },
  {
    path: '**',
    redirectTo: '',
  },
];

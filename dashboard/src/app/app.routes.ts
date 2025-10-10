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
      import('./shared/layout/layout').then((m) => m.Layout),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/servers/servers').then((feature) => feature.Servers),
        data: {
          title: 'Your Servers',
          description: 'Select a server to manage your bot configuration',
          icon: '🏠'
        }
      }
    ]
  },
  {
    path: 'servers/:serverId',
    loadComponent: () =>
      import('./shared/layout/layout').then((m) => m.Layout),
    canActivate: [authGuard, guildAccessGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/bot-config/bot-config').then((m) => m.BotConfig),
        data: {
          title: 'Bot Configuration',
          description: 'Customize your bot\'s appearance and presence for this server',
          icon: '⚙️'
        }
      },
      {
        path: 'commands',
        loadComponent: () =>
          import('./features/commands/commands').then((m) => m.Commands),
        data: {
          title: 'Commands',
          description: 'Manage and configure bot commands for this server',
          icon: '💬'
        }
      }
    ]
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

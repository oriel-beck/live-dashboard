import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../core/services/auth.service';
import { CacheStore } from '../../store/sse.store';
import { SERVER_CONTEXT_PROVIDER } from '../interfaces/server-context.interface';
import { SidebarNavigationComponent } from '../sidebar-navigation/sidebar-navigation';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, SidebarNavigationComponent, MenuModule, BadgeModule, RippleModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  providers: [CacheStore],
})
export class Layout {
  private router = inject(Router);
  public authService = inject(AuthService);
  private store = inject(CacheStore);
  private serverContextProvider = inject(SERVER_CONTEXT_PROVIDER, {
    optional: true,
  });

  // Page information signals
  pageInformation = signal<{
    title: string;
    description: string;
    icon: string;
  } | null>(null);

  userMenuItems: MenuItem[] = [
    {
      label: 'Servers',
      icon: 'pi pi-server',
      command: () => this.navigateToServers()
    },
    {
      separator: true
    },
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout()
    }
  ];

  // Computed property to determine if sidebar should be shown
  shouldShowSidebar = computed(() => {
    return !!this.serverContextProvider && this.serverContextProvider()?.id;
  });

  constructor() {
    // Listen to route changes to update page information and manage SSE connection
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => {
          // Get the deepest child route (the actual page route)
          let route = this.router.routerState.root;
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route.snapshot;
        }),
        takeUntilDestroyed()
      )
      .subscribe((route) => {
        if (route?.data) {
          this.pageInformation.set({
            title: route.data['title'] || '',
            description: route.data['description'] || '',
            icon: route.data['icon'] || '',
          });
        } else {
          this.pageInformation.set(null);
        }

        // Handle SSE connection based on route
        this.handleSSEConnection(route);
        console.log('route', route);
      });

    // Listen for SSE connection errors and redirect if max retries reached
    effect(() => {
      const error = this.store.error();
      if (error === 'Max retry attempts reached') {
        console.error(
          '[Layout] SSE connection failed after max retries, redirecting to servers page'
        );
        this.router.navigate(['/servers'], {
          queryParams: { error: 'Connection lost. Please try again.' },
        });
      }
    });
  }
// Will probably need to save the serverId so we won't reconnect to the same server if we navigate to a different child route
  private handleSSEConnection(route: any) {
    const serverId = route.params?.['serverId'];
    console.log('serverId', serverId);

    // Check if we're on a server dashboard route
    if (serverId) {
      // Connect to SSE for this server
      console.log(`[Layout] Connecting to SSE for server: ${serverId}`);
      this.store.connect(serverId);
    } else {
      // Disconnect SSE when not on a server dashboard
      console.log('[Layout] Disconnecting SSE - not on server dashboard');
      this.store.disconnect();
    }
  }

  navigateToHome() {
    this.router.navigate(['/']);
  }

  navigateToServers() {
    this.router.navigate(['/servers']);
  }

  logout() {
    this.authService.logout().subscribe();
  }

  getUserAvatarUrl(): string {
    const user = this.authService.user();
    if (user?.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }

  getServerContext() {
    return this.serverContextProvider ? this.serverContextProvider() : null;
  }

  getServerIconUrl(): string {
    const server = this.getServerContext();
    if (server && server.icon) {
      return `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=128`;
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

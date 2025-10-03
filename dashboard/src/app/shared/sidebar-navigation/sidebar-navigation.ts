import { CommonModule } from '@angular/common';
import { Component, inject, input, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CacheStore } from '../../store/sse.store';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  active?: boolean;
}

@Component({
  selector: 'app-sidebar-navigation',
  imports: [CommonModule, RouterModule, ButtonModule, MenuModule],
  templateUrl: './sidebar-navigation.html',
  styleUrl: './sidebar-navigation.scss'
})
export class SidebarNavigationComponent implements OnInit, OnDestroy {
  store = inject(CacheStore);
  router = inject(Router);
  
  // Input for mobile sidebar visibility
  isMobileMenuOpen = input<boolean>(false);
  
  // Router subscription
  private routerSubscription?: Subscription;
  
  // Navigation items
  navigationItems: NavigationItem[] = [
    {
      label: 'General',
      icon: 'pi pi-cog',
      route: '',
      active: true
    },
    {
      label: 'Commands',
      icon: 'pi pi-list',
      route: 'commands'
    }
  ];

  ngOnInit() {
    // Update active state based on current route
    this.updateActiveState();
    
    // Subscribe to route changes
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateActiveState();
      });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  isItemDisabled(item: NavigationItem): boolean {
    // Disable commands navigation while commands are loading
    if (item.route === 'commands' && this.store.isCommandsLoading()) {
      return true;
    }
    return false;
  }

  navigateToItem(item: NavigationItem): void {
    const guildId = this.store.guildId();
    if (!guildId) return;
    
    const fullRoute = item.route ? `/servers/${guildId}/${item.route}` : `/servers/${guildId}`;
    this.router.navigate([fullRoute]);
    this.updateActiveState();
  }

  private updateActiveState(): void {
    const currentUrl = this.router.url;
    const guildId = this.store.guildId();
    
    if (!guildId) return;
    
    this.navigationItems = this.navigationItems.map(item => ({
      ...item,
      active: currentUrl === `/servers/${guildId}${item.route ? '/' + item.route : ''}`
    }));
  }
}

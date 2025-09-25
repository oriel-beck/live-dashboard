import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { AuthService } from '../../core/services/auth.service';
import { CacheStore } from '../../store/sse.store';

// PrimeNG Components
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { MultiSelectModule } from 'primeng/multiselect';

// Import the command config dialog component
import { CommandConfigDialog } from '../command-config-dialog/command-config-dialog';
import {
  CommandCategory,
  CommandConfigResultWithCategory,
} from '@discord-bot/shared-types';
import { SidebarNavigationComponent } from '../../shared/sidebar-navigation/sidebar-navigation';

// Temporary interface for subcommands until they're properly implemented
interface Subcommand {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    MultiSelectModule,
    CheckboxModule,
    ButtonModule,
    DividerModule,
    SidebarNavigationComponent,
    RouterOutlet,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  providers: [CacheStore],
})
export class Dashboard {
  private authService = inject(AuthService);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  store = inject(CacheStore);

  // Selected category
  selectedCategory = signal<CommandCategory | null>(null);

  constructor() {
    // Select first category when available, but only if no category is currently selected
    effect(() => {
      if (this.store.commandsCategories() && !this.selectedCategory()) {
        this.selectedCategory.set(
          this.store.commandsCategories().values().next().value!
        );
      }
    });
  }

  // Navigation and UI methods
  navigateBack() {
    this.router.navigate(['/servers']);
  }

  navigateToHome() {
    this.router.navigate(['/']);
  }

  logout() {
    this.authService.logout().subscribe();
  }

  selectCategory(category: CommandCategory) {
    this.selectedCategory.set(category);
  }

  getGuildIconUrl(): string {
    const guild = this.store.guildInfo();
    if (guild?.icon) {
      return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
    }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }

  openCommandConfig(command: CommandConfigResultWithCategory) {
    this.dialogService.open(CommandConfigDialog, {
      header: 'Configure Permissions',
      width: '700px',
      data: {
        command: this.store.commands().get(command.id),
        guildId: this.store.guildInfo()?.id,
        roles: this.store.roles,
        channels: this.store.channels,
        commandPermissions: this.store.commandPermissions,
      },
      styleClass: 'command-config-dialog',
      closable: true,
      modal: true,
    });
  }

  // Error handling
  clearError() {
    // This method would clear errors if the store had an error clearing method
    // For now, we'll handle errors through the store's internal mechanisms
  }
}

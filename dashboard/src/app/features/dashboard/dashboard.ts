import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { AuthService } from '../../core/services/auth.service';
import {
  CommandCategory,
  CommandConfig
} from '../../core/services/guild.service';
import { CacheStore } from '../../store/sse.store';

// PrimeNG Components
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { MultiSelectModule } from 'primeng/multiselect';

// Import the command config dialog component
import { CommandConfigDialog } from '../command-config-dialog/command-config-dialog';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    MultiSelectModule,
    CheckboxModule,
    ButtonModule,
    DividerModule,
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
    // Select first category when available
    effect(() => {
      if (this.store.commandsCategories()) {
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

  openCommandConfig(command: CommandConfig) {
    const ref = this.dialogService.open(CommandConfigDialog, {
      header: `Configure Command: ${command.name}`,
      width: '700px',
      data: {
        command,
        roles: this.store.roles(),
        channels: this.store.channels(),
      },
      styleClass: 'command-config-dialog',
    });

    ref.onClose.subscribe((result: Partial<CommandConfig> | undefined) => {
      if (result) {
        this.store.saveCommandConfig({
          commandId: command.id,
          updates: result,
        });
      }
    });
  }

  getSubcommands(command: CommandConfig) {
    return command.subcommands ? Object.values(command.subcommands) : [];
  }

  getSubcommandCount(command: CommandConfig) {
    return command.subcommands ? Object.keys(command.subcommands).length : 0;
  }
}

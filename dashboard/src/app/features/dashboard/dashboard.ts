import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  CommandCategory,
  CommandConfig,
} from '../../core/services/guild.service';
import { CacheStore } from '../../store/sse.store';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  providers: [CacheStore],
})
export class Dashboard {
  private authService = inject(AuthService);
  private router = inject(Router);
  store = inject(CacheStore);

  // Selected category
  selectedCategory = signal<CommandCategory | null>(null);
  selectFirstCategory = effect(() => {
    if (this.store.commandsCategories()) {
      this.selectedCategory.set(
        this.store.commandsCategories().values().next().value!
        );
    }
  });

  // Command configuration modal
  isConfigModalOpen = signal(false);
  configModalCommand = signal<CommandConfig | null>(null);

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
    this.configModalCommand.set(command);
    this.isConfigModalOpen.set(true);
  }

  closeConfigModal() {
    this.isConfigModalOpen.set(false);
    this.configModalCommand.set(null);
  }

  getSubcommands(command: CommandConfig) {
    return command.subcommands ? Object.values(command.subcommands) : [];
  }

  getSubcommandCount(command: CommandConfig) {
    return command.subcommands ? Object.keys(command.subcommands).length : 0;
  }
}

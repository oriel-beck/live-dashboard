import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CacheStore } from '../../store/sse.store';
import { ApiService } from '../../core/services/api.service';
import { BotConfig as BotConfigType, BotConfigUpdateRequest } from '@discord-bot/shared-types';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FileUploadModule } from 'primeng/fileupload';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-bot-config',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    FileUploadModule,
    CardModule,
    DividerModule,
    ToastModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './bot-config.html',
  styleUrl: './bot-config.scss',
  providers: [MessageService],
})
export class BotConfig implements OnInit {
  store = inject(CacheStore);
  messageService = inject(MessageService);
  apiService = inject(ApiService);

  // Local state
  botConfig = signal<BotConfigType>({
    guildId: '',
    nickname: ''
  });

  isSaving = signal(false);
  isLoading = signal(true);

  ngOnInit() {
    this.loadBotConfig();
  }

  private async loadBotConfig(): Promise<void> {
    const guildId = this.store.guildId();
    if (!guildId) return;

    try {
      this.isLoading.set(true);
      const response = await this.apiService.get<BotConfigType>(
        `/guilds/${guildId}/bot-config`
      ).toPromise();

      if (response?.success && response?.data) {
        this.botConfig.set(response.data);
      }
    } catch (error) {
      console.error('Error loading bot configuration:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Load Failed',
        detail: 'Failed to load bot configuration',
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  getCurrentAvatarUrl(): string {
    const guildInfo = this.store.guildInfo();
    if (!guildInfo) return '/assets/default-avatar.png';

    // If custom avatar is set, use it, otherwise use guild icon as fallback
    return (
      this.botConfig().avatar ||
      (guildInfo.icon
        ? `https://cdn.discordapp.com/icons/${guildInfo.id}/${guildInfo.icon}.png?size=512`
        : '/assets/default-avatar.png')
    );
  }

  onAvatarSelect(event: any): void {
    const file = event.files[0];

    if (file) {
      // Validate file size (max 8MB for Discord)
      if (file.size > 8 * 1024 * 1024) {
        this.messageService.add({
          severity: 'error',
          summary: 'File Too Large',
          detail: 'File size must be less than 8MB',
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.messageService.add({
          severity: 'error',
          summary: 'Invalid File Type',
          detail: 'Please select a valid image file (JPG, PNG, GIF)',
        });
        return;
      }

      // Create base64 Data URI for Discord API
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.botConfig.update((config) => ({
          ...config,
          avatar: result, // This will be a data:image/...;base64,... string
        }));
        this.messageService.add({
          severity: 'success',
          summary: 'Avatar Updated',
          detail: 'Avatar preview updated successfully',
        });
      };
      reader.readAsDataURL(file);
    }
  }

  onBannerSelect(event: any): void {
    const file = event.files[0];

    if (file) {
      // Validate file size (max 8MB)
      if (file.size > 8 * 1024 * 1024) {
        this.messageService.add({
          severity: 'error',
          summary: 'File Too Large',
          detail: 'File size must be less than 8MB',
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.messageService.add({
          severity: 'error',
          summary: 'Invalid File Type',
          detail: 'Please select a valid image file (JPG, PNG, GIF)',
        });
        return;
      }

      // Create base64 Data URI for Discord API
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.botConfig.update((config) => ({
          ...config,
          banner: result, // This will be a data:image/...;base64,... string
        }));
        this.messageService.add({
          severity: 'success',
          summary: 'Banner Updated',
          detail: 'Banner preview updated successfully',
        });
      };
      reader.readAsDataURL(file);
    }
  }

  resetAvatar(): void {
    this.botConfig.update((config) => ({
      ...config,
      avatar: undefined,
    }));
  }

  resetBanner(): void {
    this.botConfig.update((config) => ({
      ...config,
      banner: undefined,
    }));
  }

  async saveConfiguration(): Promise<void> {
    const guildId = this.store.guildId();
    if (!guildId) return;

    this.isSaving.set(true);

    try {
      const configData = this.botConfig();

      const response = await this.apiService.put<BotConfigType>(
        `/guilds/${guildId}/bot-config`,
        {
          avatar: configData.avatar,
          banner: configData.banner,
          nickname: configData.nickname
        }
      ).toPromise();

      if (response?.success) {
        this.messageService.add({
          severity: 'success',
          summary: 'Configuration Saved',
          detail: 'Bot configuration saved successfully!',
        });

        // Update local state with server response
        if (response.data) {
          this.botConfig.set(response.data);
        }
      } else {
        throw new Error(response?.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving bot configuration:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: 'Failed to save configuration. Please try again.',
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  async resetConfiguration(): Promise<void> {
    const guildId = this.store.guildId();
    if (!guildId) return;

    try {
      this.isSaving.set(true);

      const response = await this.apiService.delete<any>(
        `/guilds/${guildId}/bot-config`
      ).toPromise();

      if (response?.success) {
        this.messageService.add({
          severity: 'success',
          summary: 'Configuration Reset',
          detail: 'Bot configuration reset successfully!',
        });

        // Reload the configuration to get the updated state
        await this.loadBotConfig();
      } else {
        throw new Error(response?.error || 'Failed to reset configuration');
      }
    } catch (error) {
      console.error('Error resetting bot configuration:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Reset Failed',
        detail: 'Failed to reset configuration. Please try again.',
      });
    } finally {
      this.isSaving.set(false);
    }
  }
}

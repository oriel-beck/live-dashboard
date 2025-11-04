import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import { CacheStore } from '../../store/sse.store';
import { ApiService } from '../../core/services/api.service';
import {
  BotConfig as BotConfigType,
  BotConfigUpdateRequest,
} from '@discord-bot/shared-types';

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
    ReactiveFormsModule,
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
  // Dependencies
  readonly store = inject(CacheStore);
  private readonly messageService = inject(MessageService);
  private readonly apiService = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  // Constants
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  // Reactive Form
  readonly botConfigForm = this.fb.group({
    avatar: this.fb.control<string | undefined>(undefined),
    banner: this.fb.control<string | undefined>(undefined),
    nickname: this.fb.control<string | undefined>(undefined, [
      Validators.maxLength(32),
    ]),
  });

  readonly botConfigSignal = signal<typeof this.botConfigForm.value>({
    avatar: undefined,
    banner: undefined,
    nickname: undefined,
  });

  readonly isSaving = signal(false);

  constructor() {
    // Sync form with SSE store data when available
    effect(() => {
      const sseProfile = this.store.botProfile();
      if (sseProfile) {
        this.botConfigForm.patchValue(
          {
            avatar: sseProfile.avatar,
            banner: sseProfile.banner,
            nickname: sseProfile.nickname,
          },
          { emitEvent: false }
        );
      }
    });
  }

  // Lifecycle
  ngOnInit() {
    this.botConfigForm.valueChanges.subscribe({
      next: (value) => {
        this.botConfigSignal.set(value);
      },
    });
  }

  // Computed properties
  currentAvatarUrl = computed(() => {
    const formValue = this.botConfigSignal().avatar;
    const sseProfile = this.store.botProfile();
    const globalProfile = this.store.globalBotProfile();
    
    // If form has a custom value, show it
    if (formValue) {
      return formValue;
    }

    // Otherwise show the current guild avatar or default to global avatar
    return sseProfile?.avatar || globalProfile?.avatar || '/assets/default-avatar.png';
  });

  currentBannerUrl = computed(() => {
    const formValue = this.botConfigSignal().banner;
    const sseProfile = this.store.botProfile();
    const globalProfile = this.store.globalBotProfile();

    // If form has a custom value, show it
    if (formValue) {
      return formValue;
    }

    // Otherwise show the current guild banner or default to global banner
    return sseProfile?.banner || globalProfile?.banner || '';
  });

  hasAvatarChanges = computed(() => {
    const formValue = this.botConfigSignal().avatar;
    const sseProfile = this.store.botProfile();
    
    // Only detect changes if form has a value
    if (formValue) {
      return formValue !== sseProfile?.avatar;
    }
    
    // If form is undefined, no changes
    return false;
  });

  hasBannerChanges = computed(() => {
    const formValue = this.botConfigSignal().banner;
    const sseProfile = this.store.botProfile();
    
    // Only detect changes if form has a value
    if (formValue) {
      return formValue !== sseProfile?.banner;
    }
    
    // If form is undefined, no changes
    return false;
  });

  hasNicknameChanges = computed(() => {
    const formValue = this.botConfigSignal().nickname;
    const sseProfile = this.store.botProfile();
    
    // Only detect changes if form has a value
    if (formValue) {
      return formValue !== sseProfile?.nickname;
    }
    
    // If form is undefined, no changes
    return false;
  });

  hasAnyChanges = computed(() => {
    return (
      this.hasAvatarChanges() ||
      this.hasBannerChanges() ||
      this.hasNicknameChanges()
    );
  });

  // Show reset button when there's a custom avatar to reset
  showAvatarReset = computed(() => {
    const formValue = this.botConfigSignal().avatar;
    
    // Only show reset button if form has a custom value
    return formValue != null;
  });

  // Show reset button when there's a custom banner to reset
  showBannerReset = computed(() => {
    const formValue = this.botConfigSignal().banner;
    
    // Only show reset button if form has a custom value
    return formValue != null;
  });

  // Show reset button when there's a custom nickname to reset
  showNicknameReset = computed(() => {
    const formValue = this.botConfigSignal().nickname;
    
    // Only show reset button if form has a custom value
    return formValue != null;
  });

  // File handling
  private validateFile(file: File): string | null {
    if (file.size > this.MAX_FILE_SIZE) {
      return 'File size must be less than 8MB';
    }

    if (
      !this.ALLOWED_IMAGE_TYPES.includes(file.type) &&
      !file.type.startsWith('image/')
    ) {
      return 'Please select a valid image file (JPG, PNG, GIF, WebP)';
    }

    return null;
  }

  private processImageFile(file: File, type: 'avatar' | 'banner'): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.botConfigForm.patchValue({
        [type]: result,
      });

      this.messageService.add({
        severity: 'success',
        summary: `${type === 'avatar' ? 'Avatar' : 'Banner'} Updated`,
        detail: `${
          type === 'avatar' ? 'Avatar' : 'Banner'
        } preview updated successfully`,
      });
    };
    reader.readAsDataURL(file);
  }

  onAvatarSelect(event: any): void {
    const file = event.files[0];
    if (!file) return;

    const validationError = this.validateFile(file);
    if (validationError) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid File',
        detail: validationError,
      });
      return;
    }

    this.processImageFile(file, 'avatar');
  }

  onBannerSelect(event: any): void {
    const file = event.files[0];
    if (!file) return;

    const validationError = this.validateFile(file);
    if (validationError) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid File',
        detail: validationError,
      });
      return;
    }

    this.processImageFile(file, 'banner');
  }

  // Form reset methods
  private resetField(field: 'avatar' | 'banner'): void {
    // Reset to undefined to clear custom value
    this.botConfigForm.patchValue({
      [field]: undefined,
    });

    const fieldName = field === 'avatar' ? 'Avatar' : 'Banner';
    this.messageService.add({
      severity: 'info',
      summary: `${fieldName} Reset`,
      detail: `${fieldName} reset to default appearance`,
    });
  }

  resetAvatar(): void {
    this.resetField('avatar');
  }

  resetBanner(): void {
    this.resetField('banner');
  }

  resetNickname(): void {
    this.botConfigForm.patchValue({
      nickname: undefined,
    });

    this.messageService.add({
      severity: 'info',
      summary: 'Nickname Reset',
      detail: 'Nickname reset to default bot name',
    });
  }

  // API operations
  private showToast(
    severity: 'success' | 'error' | 'info',
    summary: string,
    detail: string
  ): void {
    this.messageService.add({ severity, summary, detail });
  }

  saveConfiguration(): void {
    const guildId = this.store.guildId();
    if (!guildId) return;

    this.isSaving.set(true);
    const configData = this.botConfigSignal();

    // Convert undefined values to null for API (null means reset to default)
    const apiData = {
      avatar: configData.avatar || null,
      banner: configData.banner || null,
      nickname: configData.nickname || null,
    };

    this.apiService
      .put<BotConfigType>(`/guilds/${guildId}/bot-config`, apiData)
      .subscribe({
        next: (response) => {
          if (response?.success) {
            this.showToast(
              'success',
              'Configuration Saved',
              'Bot configuration saved successfully!'
            );
            // Configuration will be updated automatically via SSE
          } else {
            this.showToast(
              'error',
              'Save Failed',
              response?.error || 'Failed to save configuration'
            );
          }
        },
        error: (error) => {
          console.error('Error saving bot configuration:', error);
          this.showToast(
            'error',
            'Save Failed',
            'Failed to save configuration. Please try again.'
          );
        },
        complete: () => {
          this.isSaving.set(false);
        },
      });
  }

  resetConfiguration(): void {
    const guildId = this.store.guildId();
    if (!guildId) return;

    this.isSaving.set(true);

    this.apiService.delete<any>(`/guilds/${guildId}/bot-config`).subscribe({
      next: (response) => {
        if (response?.success) {
          this.showToast(
            'success',
            'Configuration Reset',
            'Bot configuration reset successfully!'
          );
          // Configuration will be updated automatically via SSE
        } else {
          this.showToast(
            'error',
            'Reset Failed',
            response?.error || 'Failed to reset configuration'
          );
        }
      },
      error: (error) => {
        console.error('Error resetting bot configuration:', error);
        this.showToast(
          'error',
          'Reset Failed',
          'Failed to reset configuration. Please try again.'
        );
      },
      complete: () => {
        this.isSaving.set(false);
      },
    });
  }
}

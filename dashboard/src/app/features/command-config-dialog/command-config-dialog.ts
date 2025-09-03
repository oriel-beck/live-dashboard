import { CommonModule } from '@angular/common';
import { Component, computed, inject, Signal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CommandConfigResultWithCategory,
  GuildChannel,
  GuildRole,
} from '@discord-bot/shared-types';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MultiSelectModule } from 'primeng/multiselect';

@Component({
  selector: 'app-command-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    CheckboxModule,
    MultiSelectModule,
    DividerModule,
  ],
  templateUrl: './command-config-dialog.html',
  styleUrl: './command-config-dialog.scss',
})
export class CommandConfigDialog {
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  // Get data from dialog config
  command: Signal<CommandConfigResultWithCategory> = signal(this.config.data.command);
  roles: Signal<GuildRole[]> = this.config.data.roles;
  channels: Signal<GuildChannel[]> = this.config.data.channels;

  // Configuration form data
  configForm = computed(() => {
    const command = this.command();
    if (!command) return {};
    return {
      whitelistedRoles: [...command.whitelistedRoles],
      blacklistedRoles: [...command.blacklistedRoles],
      whitelistedChannels: [...command.whitelistedChannels],
      blacklistedChannels: [...command.blacklistedChannels],
      bypassRoles: [...command.bypassRoles],
    };
  });

  // MultiSelect options
  roleOptions = computed(() =>
    this.roles().map((role) => ({ label: role.name, value: role.id }))
  );

  channelOptions = computed(() =>
    this.channels().map((channel) => ({
      label: `#${channel.name}`,
      value: channel.id,
    }))
  );

  // Design tokens for multiselect styling
  multiselectTokens = {
    colorScheme: {
      light: {
        root: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          color: '#ffffff',
        },
        label: {
          color: '#ffffff',
        },
        trigger: {
          color: '#b4b8c0',
        },
        overlay: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
        },
        header: {
          background: '#1e1f23',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
        filter: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          color: '#ffffff',
        },
        option: {
          background: 'transparent',
          color: '#ffffff',
          hoverBackground: 'rgba(99, 102, 241, 0.15)',
          hoverColor: '#ffffff',
          selectedBackground: '#6366f1',
          selectedColor: '#ffffff',
          focusBackground: 'rgba(99, 102, 241, 0.2)',
          focusColor: '#ffffff',
        },
        token: {
          background: '#6366f1',
          color: '#ffffff',
        },
      },
      dark: {
        root: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          color: '#ffffff',
        },
        label: {
          color: '#ffffff',
        },
        trigger: {
          color: '#b4b8c0',
        },
        overlay: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
        },
        header: {
          background: '#1e1f23',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
        filter: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          color: '#ffffff',
        },
        option: {
          background: 'transparent',
          color: '#ffffff',
          hoverBackground: 'rgba(99, 102, 241, 0.15)',
          hoverColor: '#ffffff',
          selectedBackground: '#6366f1',
          selectedColor: '#ffffff',
          focusBackground: 'rgba(99, 102, 241, 0.2)',
          focusColor: '#ffffff',
        },
        token: {
          background: '#6366f1',
          color: '#ffffff',
        },
      },
    },
  };

  onSave() {
    this.ref.close(this.configForm());
  }

  onCancel() {
    this.ref.close();
  }
}

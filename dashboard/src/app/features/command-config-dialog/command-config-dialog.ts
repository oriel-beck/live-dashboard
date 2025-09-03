import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { DividerModule } from 'primeng/divider';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { CommandConfigResultWithCategory, GuildRole, GuildChannel } from '@discord-bot/shared-types';

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
  // Get data from dialog config
  command: CommandConfigResultWithCategory;
  roles: GuildRole[];
  channels: GuildChannel[];

  // Configuration form data
  configForm = signal<Partial<CommandConfigResultWithCategory>>({});

  // MultiSelect options
  roleOptions = signal<{ label: string; value: string }[]>([]);
  channelOptions = signal<{ label: string; value: string }[]>([]);

  // Design tokens for multiselect styling
  multiselectTokens = {
    colorScheme: {
      light: {
        root: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          color: '#ffffff'
        },
        label: {
          color: '#ffffff'
        },
        trigger: {
          color: '#b4b8c0'
        },
        overlay: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px'
        },
        header: {
          background: '#1e1f23',
          borderColor: 'rgba(255, 255, 255, 0.08)'
        },
        filter: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          color: '#ffffff'
        },
        option: {
          background: 'transparent',
          color: '#ffffff',
          hoverBackground: 'rgba(99, 102, 241, 0.15)',
          hoverColor: '#ffffff',
          selectedBackground: '#6366f1',
          selectedColor: '#ffffff',
          focusBackground: 'rgba(99, 102, 241, 0.2)',
          focusColor: '#ffffff'
        },
        token: {
          background: '#6366f1',
          color: '#ffffff'
        }
      },
      dark: {
        root: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          color: '#ffffff'
        },
        label: {
          color: '#ffffff'
        },
        trigger: {
          color: '#b4b8c0'
        },
        overlay: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px'
        },
        header: {
          background: '#1e1f23',
          borderColor: 'rgba(255, 255, 255, 0.08)'
        },
        filter: {
          background: '#141518',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          color: '#ffffff'
        },
        option: {
          background: 'transparent',
          color: '#ffffff',
          hoverBackground: 'rgba(99, 102, 241, 0.15)',
          hoverColor: '#ffffff',
          selectedBackground: '#6366f1',
          selectedColor: '#ffffff',
          focusBackground: 'rgba(99, 102, 241, 0.2)',
          focusColor: '#ffffff'
        },
        token: {
          background: '#6366f1',
          color: '#ffffff'
        }
      }
    }
  };

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig
  ) {
    // Get data from dialog config
    this.command = config.data.command;
    this.roles = config.data.roles;
    this.channels = config.data.channels;

    // Initialize form and options
    this.initializeForm();
    this.updateOptions();
  }

  private initializeForm() {
    if (!this.command) return;

    this.configForm.set({
      whitelistedRoles: [...this.command.whitelistedRoles],
      blacklistedRoles: [...this.command.blacklistedRoles],
      whitelistedChannels: [...this.command.whitelistedChannels],
      blacklistedChannels: [...this.command.blacklistedChannels],
      bypassRoles: [...this.command.bypassRoles],
    });
  }

  private updateOptions() {
    // Update role options
    this.roleOptions.set(
      this.roles.map((role) => ({
        label: role.name,
        value: role.id,
      }))
    );

    // Update channel options (all channels from backend are text/announcement/voice channels)
    this.channelOptions.set(
      this.channels.map((channel) => ({
        label: `#${channel.name}`,
        value: channel.id,
      }))
    );
  }

  onSave() {
    this.ref.close(this.configForm());
  }

  onCancel() {
    this.ref.close();
  }
}

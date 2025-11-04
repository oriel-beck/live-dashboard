import {
  Component,
  computed,
  inject,
  Signal,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { DialogService } from 'primeng/dynamicdialog';
import { injectParams } from 'ngxtension/inject-params';
import {
  CommandCategory,
  CommandConfigResultWithCategory,
  GuildApplicationCommandPermissions,
  GuildChannel,
  GuildRole,
} from '@discord-bot/shared-types';
import { CacheStore } from '../../store/sse.store';
import { CommandConfigDialog } from '../command-config-dialog/command-config-dialog';
//
@Component({
  selector: 'app-commands',
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TabsModule,
    BadgeModule,
    TooltipModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './commands.html',
  styleUrl: './commands.scss',
})
export class Commands implements OnInit {
  private store = inject(CacheStore);
  private dialogService = inject(DialogService);
  private params = injectParams();

  // Computed properties from store
  commandsCategories: Signal<Map<number, CommandCategory>> =
    this.store.commandsCategories;
  isCommandsLoading: Signal<boolean> = this.store.isCommandsLoading;
  isCommandsConfigLoading: Signal<boolean> = this.store.isCommandsConfigLoading;
  roles: Signal<GuildRole[]> = this.store.roles;
  channels: Signal<GuildChannel[]> = this.store.channels;
  commandPermissions: Signal<Map<string, GuildApplicationCommandPermissions>> =
    this.store.commandPermissions;
  error: Signal<string | null> = this.store.error;

  // Get guild ID from route params
  guildId: Signal<string> = computed(() => this.params()['serverId']);

  // Selected category
  selectedCategory = signal<CommandCategory | null>(null);

  // Convert Map to Array for template iteration
  categoriesArray = computed(() => {
    const categories = this.commandsCategories();
    return Array.from(categories.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  });

  // Get commands for selected category
  selectedCategoryCommands = computed(() => {
    const category = this.selectedCategory();
    return category?.commands || [];
  });

  // Initialize with first category when available
  ngOnInit() {
    // Select first category when available
    const categories = this.categoriesArray();
    if (categories.length > 0 && !this.selectedCategory()) {
      this.selectedCategory.set(categories[0]);
    }
  }

  // Helper method to get permission text for a command
  getPermissionText(command: CommandConfigResultWithCategory): string {
    if (!command.permissions || command.permissions === '0') {
      return 'None required';
    }

    const permissionBits = BigInt(command.permissions);
    const permissionNames = this.getPermissionNames(permissionBits);

    if (permissionNames.length === 0) {
      return 'Custom permissions';
    }

    if (permissionNames.length === 1) {
      return permissionNames[0];
    } else if (permissionNames.length <= 3) {
      return permissionNames.join(', ');
    } else {
      return `${permissionNames.slice(0, 2).join(', ')} +${
        permissionNames.length - 2
      } more`;
    }
  }

  // Helper method to get tooltip text for multiple permissions
  getPermissionTooltip(command: CommandConfigResultWithCategory): string {
    if (!command.permissions || command.permissions === '0') {
      return 'No permissions required';
    }

    const permissionBits = BigInt(command.permissions);
    const permissionNames = this.getPermissionNames(permissionBits);

    if (permissionNames.length === 0) {
      return 'Custom permissions';
    }

    if (permissionNames.length === 1) {
      return permissionNames[0];
    }

    return `Required permissions:\n${permissionNames.join('\n')}`;
  }

  // Helper method to extract permission names from bits
  private getPermissionNames(permissionBits: bigint): string[] {
    const permissionNames: string[] = [];

    // Common Discord permissions
    if (permissionBits & BigInt(0x20)) permissionNames.push('Manage Server');
    if (permissionBits & BigInt(0x10)) permissionNames.push('Manage Channels');
    if (permissionBits & BigInt(0x1000)) permissionNames.push('Manage Roles');
    if (permissionBits & BigInt(0x2000)) permissionNames.push('Manage Emojis');
    if (permissionBits & BigInt(0x40)) permissionNames.push('Kick Members');
    if (permissionBits & BigInt(0x80)) permissionNames.push('Ban Members');
    if (permissionBits & BigInt(0x400)) permissionNames.push('Manage Messages');
    if (permissionBits & BigInt(0x40000))
      permissionNames.push('Read Message History');
    if (permissionBits & BigInt(0x80000))
      permissionNames.push('Mention Everyone');
    if (permissionBits & BigInt(0x100000))
      permissionNames.push('Use External Emojis');
    if (permissionBits & BigInt(0x200000))
      permissionNames.push('Add Reactions');
    if (permissionBits & BigInt(0x1000000))
      permissionNames.push('Mute Members');
    if (permissionBits & BigInt(0x2000000))
      permissionNames.push('Deafen Members');
    if (permissionBits & BigInt(0x4000000))
      permissionNames.push('Move Members');
    if (permissionBits & BigInt(0x8000000))
      permissionNames.push('Use Voice Activity');

    return permissionNames;
  }

  // Open command configuration dialog
  openCommandConfig(command: CommandConfigResultWithCategory) {
    if (!command.discordId) {
      console.error('Command not registered with Discord');
      return;
    }

    this.dialogService.open(CommandConfigDialog, {
      header: `Configure ${command.name}`,
      width: '80vw',
      height: '80vh',
      data: {
        command,
        guildId: this.guildId(),
        roles: this.roles,
        channels: this.channels,
        commandPermissions: this.commandPermissions,
      },
    });
  }

  // Select a category
  selectCategory(category: CommandCategory) {
    this.selectedCategory.set(category);
  }
}

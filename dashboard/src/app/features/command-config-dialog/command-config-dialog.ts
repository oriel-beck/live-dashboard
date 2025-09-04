import { CommonModule } from '@angular/common';
import { Component, computed, inject, Signal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApplicationCommandPermission,
  CommandConfigResultWithCategory,
  CommandPermissionsResponse,
  DISCORD_PERMISSION_TYPES,
  GuildApplicationCommandPermissions,
  GuildChannel,
  GuildRole,
} from '@discord-bot/shared-types';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import {
  DialogService,
  DynamicDialogConfig,
  DynamicDialogRef,
} from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';

interface PermissionItem {
  id: string;
  name: string;
  type: 'role' | 'channel';
  permission: boolean;
  originalPermission?: boolean;
}

@Component({
  selector: 'app-command-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    CheckboxModule,
    DividerModule,
    TooltipModule,
    MultiSelectModule,
    SelectModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './command-config-dialog.html',
  styleUrl: './command-config-dialog.scss',
})
export class CommandConfigDialog {
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);
  apiService = inject(ApiService);
  dialogService = inject(DialogService);

  // Get data from dialog config
  command: Signal<CommandConfigResultWithCategory> = signal(
    this.config.data.command
  );
  guildId: Signal<string> = signal(this.config.data.guildId);
  roles: Signal<GuildRole[]> = this.config.data.roles;
  channels: Signal<GuildChannel[]> = this.config.data.channels;

  // Permissions state
  permissions = signal<PermissionItem[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // Multi-select state
  selectedRoles = signal<string[]>([]);
  selectedChannels = signal<string[]>([]);

  // Computed properties
  availableRoles = computed(() => {
    const currentPermissions = this.permissions();
    const roleIds = new Set(
      currentPermissions.filter((p) => p.type === 'role').map((p) => p.id)
    );
    return this.roles()
      .filter((role) => !roleIds.has(role.id))
      .sort((a, b) => a.position - b.position);
  });

  availableChannels = computed(() => {
    const currentPermissions = this.permissions();
    const channelIds = new Set(
      currentPermissions.filter((p) => p.type === 'channel').map((p) => p.id)
    );
    return this.channels()
      .filter((channel) => !channelIds.has(channel.id))
      .sort((a, b) => a.position - b.position);
  });

  hasChanges = computed(() =>
    this.permissions().some((p) => p.permission !== p.originalPermission)
  );

  requiredPermissions = computed(() => {
    const command = this.command();
    if (!command.permissions || command.permissions === '0') {
      return 'None required';
    }
    return this.getPermissionText(command.permissions);
  });

  hasRequiredPermissions = computed(() => {
    const command = this.command();
    return command.permissions && command.permissions !== '0';
  });

  // Helper method to convert Discord permission bits to readable text
  getPermissionText(permissions: string): string {
    if (!permissions || permissions === '0') {
      return 'None required';
    }

    const permissionBits = BigInt(permissions);
    const permissionNames = this.getPermissionNames(permissionBits);

    if (permissionNames.length === 0) {
      return 'Custom permissions';
    }

    // Show first permission + count of additional ones
    if (permissionNames.length === 1) {
      return permissionNames[0];
    } else {
      return `${permissionNames[0]} +${permissionNames.length - 1}`;
    }
  }

  // Parse command permissions into readable format
  parseCommandPermissions(): string {
    const command = this.command();
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
  getPermissionTooltip(permissions: string): string {
    if (!permissions || permissions === '0') {
      return 'No permissions required';
    }

    const permissionBits = BigInt(permissions);
    const permissionNames = this.getPermissionNames(permissionBits);

    if (permissionNames.length === 0) {
      return 'Custom permissions';
    }

    if (permissionNames.length === 1) {
      return permissionNames[0];
    }

    // Show all permissions in tooltip
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

  ngOnInit() {
    this.loadPermissions();
  }

  async loadPermissions() {
    this.loading.set(true);
    this.error.set(null);

    const command = this.command();
    if (!command.discordId) {
      throw new Error('Command not registered with Discord');
    }

    // Get specific command permissions
    this.apiService
      .get<GuildApplicationCommandPermissions>(
        `/guilds/${this.guildId()}/commands/${command.discordId}/permissions`
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.permissions) {
            const commandPermissionItems: PermissionItem[] =
              response.data.permissions.map(
                (perm: ApplicationCommandPermission) => ({
                  id: perm.id,
                  name: this.getPermissionName(perm.id, perm.type),
                  type: this.getPermissionTypeName(perm.type),
                  permission: perm.permission,
                  originalPermission: perm.permission,
                })
              );
            this.permissions.set(commandPermissionItems);
          } else {
            // No command-specific permissions, use application-level
            this.permissions.set([]);
          }
        },
        error: (error) => {
          console.error('Error loading command specific permissions:', error);
          // If command-specific permissions don't exist, use application-level
          this.permissions.set([]);
        },
        complete: () => {
          this.loading.set(false);
        },
      });
  }

  getPermissionName(id: string, type: number): string {
    switch (type) {
      case DISCORD_PERMISSION_TYPES.ROLE:
        const role = this.roles().find((r) => r.id === id);
        return role
          ? role.id === this.guildId()
            ? '@everyone'
            : role.name.startsWith('@')
            ? role.name
            : `@${role.name}`
          : `Role ${id}`;
      case DISCORD_PERMISSION_TYPES.CHANNEL:
        const channel = this.channels().find((c) => c.id === id);
        return channel
          ? channel.name.startsWith('#')
            ? channel.name
            : `#${channel.name}`
          : id === (BigInt(this.guildId()) - BigInt(1)).toString()
          ? 'All Channels'
          : `Channel ${id}`;
      case DISCORD_PERMISSION_TYPES.USER:
        return `User ${id}`;
      default:
        return `Unknown ${id}`;
    }
  }

  getPermissionTypeName(type: number): 'role' | 'channel' {
    switch (type) {
      case DISCORD_PERMISSION_TYPES.ROLE:
        return 'role';
      case DISCORD_PERMISSION_TYPES.CHANNEL:
        return 'channel';
      default:
        return 'role';
    }
  }

  getPermissionTypeNumber(type: 'role' | 'channel'): number {
    switch (type) {
      case 'role':
        return DISCORD_PERMISSION_TYPES.ROLE;
      case 'channel':
        return DISCORD_PERMISSION_TYPES.CHANNEL;
    }
  }

  // Computed properties for multi-select
  canAddRoles = computed(() => this.selectedRoles().length > 0);
  canAddChannels = computed(() => this.selectedChannels().length > 0);

  selectedRolesCount = computed(() => this.selectedRoles().length);
  selectedChannelsCount = computed(() => this.selectedChannels().length);

  // Multi-select methods for roles
  cancelRoleSelection() {
    this.selectedRoles.set([]);
  }

  addSelectedRoles() {
    for (const roleId of this.selectedRoles()) {
      this.addRolePermission(roleId, true); // Default to Allow
    }
    this.selectedRoles.set([]); // Clear selections after adding
  }

  // Multi-select methods for channels
  cancelChannelSelection() {
    this.selectedChannels.set([]);
  }

  addSelectedChannels() {
    for (const channelId of this.selectedChannels()) {
      this.addChannelPermission(channelId, true); // Default to Allow
    }
    this.selectedChannels.set([]); // Clear selections after adding
  }

  addRolePermission(roleId: string, permission: boolean) {
    const name = this.getPermissionName(
      roleId,
      this.getPermissionTypeNumber('role')
    );

    const newPermission: PermissionItem = {
      id: roleId,
      name,
      type: 'role',
      permission,
      originalPermission: permission,
    };

    this.permissions.update((perms) => [...perms, newPermission]);
    this.error.set(null);
  }

  addChannelPermission(channelId: string, permission: boolean) {
    const name = this.getPermissionName(
      channelId,
      this.getPermissionTypeNumber('channel')
    );

    const newPermission: PermissionItem = {
      id: channelId,
      name,
      type: 'channel',
      permission,
      originalPermission: permission,
    };

    this.permissions.update((perms) => [...perms, newPermission]);
    this.error.set(null);
  }

  getPermissionIndex(permissionId: string): number {
    return this.permissions().findIndex((p) => p.id === permissionId);
  }

  rolePermissions = computed(() => {
    return this.permissions().filter((p) => p.type === 'role');
  });

  channelPermissions = computed(() => {
    return this.permissions().filter((p) => p.type === 'channel');
  });

  removePermission(index: number) {
    this.permissions.update((perms) => perms.filter((_, i) => i !== index));
  }

  togglePermission(index: number) {
    this.permissions.update((perms) => {
      const newPerms = [...perms];
      newPerms[index].permission = !newPerms[index].permission;
      return newPerms;
    });
  }

  setPermission(index: number, permission: boolean) {
    this.permissions.update((perms) => {
      const newPerms = [...perms];
      newPerms[index].permission = permission;
      return newPerms;
    });
  }

  async savePermissions() {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const command = this.command();
    if (!command.discordId) {
      throw new Error('Command not registered with Discord');
    }

    const permissions: ApplicationCommandPermission[] = this.permissions().map(
      (perm) => ({
        id: perm.id,
        type: this.getPermissionTypeNumber(perm.type),
        permission: perm.permission,
      })
    );

    this.apiService
      .put<CommandPermissionsResponse>(
        `/guilds/${this.guildId()}/commands/${command.discordId}/permissions`,
        { permissions }
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.success.set('Command permissions updated successfully');
            this.permissions.update((perms) =>
              perms.map((perm) => ({
                ...perm,
                originalPermission: perm.permission,
              }))
            );
          } else {
            throw new Error('Failed to update permissions');
          }
        },
        error: (error) => {
          console.error('Error saving permissions:', error);
          this.error.set('Failed to update permissions');
        },
        complete: () => {
          this.saving.set(false);
          this.ref.close(true);
        },
      });
  }

  onSave() {
    this.savePermissions();
  }

  onCancel() {
    this.ref.close();
  }

  selectMenuDt = {
    colorScheme: {
      dark: {
        root: {
          color: '#ffffff',
        },
        option: {
          color: '#ffffff',
          selectedBackground: '#36393f',
          selectedColor: '#ffffff',
          focusBackground: '#4a4b54', //lighter than selectedBackground
          focusColor: '#ffffff',
        },
        overlay: {
          background: '#36393f',
        },
      },
    },
  };
}

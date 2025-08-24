import { inject, Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { ApiService } from './api.service';

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites: any[];
}

export interface CommandConfig {
  id: number;
  discordId?: string;
  name: string;
  description: string;
  enabled: boolean;
  permissions: string;
  cooldown: number;
  whitelistedRoles: string[];
  blacklistedRoles: string[];
  whitelistedChannels: string[];
  blacklistedChannels: string[];
  bypassRoles: string[];
  subcommands?: Record<string, any>;
  category?: CommandCategory;
  categoryId?: number;
}

export interface CommandCategory {
  id: number;
  name: string;
  description: string;
  updatedAt: Date;
  createdAt: Date;
  commands: CommandConfig[];
}

@Injectable({
  providedIn: 'root'
})
export class GuildService {
  private readonly apiService = inject(ApiService);

  getGuildInfo(guildId: string): Observable<GuildInfo | null> {
    return this.apiService.get<GuildInfo>(`/guilds/${guildId}`).pipe(
      map(response => response.success ? response.data || null : null),
      catchError(error => {
        console.error('Failed to fetch guild info:', error);
        return of(null);
      })
    );
  }

  getGuildRoles(guildId: string): Observable<GuildRole[]> {
    return this.apiService.get<{ roles: GuildRole[] }>(`/guilds/${guildId}/roles`).pipe(
      map(response => response.success ? response.data?.roles || [] : []),
      catchError(error => {
        console.error('Failed to fetch guild roles:', error);
        return of([]);
      })
    );
  }

  getGuildChannels(guildId: string): Observable<GuildChannel[]> {
    return this.apiService.get<{ channels: GuildChannel[] }>(`/guilds/${guildId}/channels`).pipe(
      map(response => response.success ? response.data?.channels || [] : []),
      catchError(error => {
        console.error('Failed to fetch guild channels:', error);
        return of([]);
      })
    );
  }

  getGuildCommands(guildId: string, withSubcommands = false): Observable<Record<string, CommandConfig>> {
    const params = withSubcommands ? '?withSubcommands=true' : '';
    return this.apiService.get<Record<string, CommandConfig>>(`/guilds/${guildId}/commands${params}`).pipe(
      map(response => response.success ? response.data || {} : {}),
      catchError(error => {
        console.error('Failed to fetch guild commands:', error);
        return of({});
      })
    );
  }

  updateCommandConfig(guildId: string, commandId: number, updates: Partial<CommandConfig>): Observable<CommandConfig | null> {
    return this.apiService.put<CommandConfig>(`/guilds/${guildId}/commands/${commandId}`, updates).pipe(
      map(response => response.success ? response.data || null : null),
      catchError(error => {
        console.error('Failed to update command config:', error);
        return of(null);
      })
    );
  }

  updateSubcommandConfig(guildId: string, commandId: number, subcommandName: string, updates: any): Observable<any> {
    return this.apiService.put(`/guilds/${guildId}/commands/${commandId}/${subcommandName}`, updates).pipe(
      map(response => response.success ? response.data || null : null),
      catchError(error => {
        console.error('Failed to update subcommand config:', error);
        return of(null);
      })
    );
  }
}

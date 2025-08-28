import { inject, Injectable } from '@angular/core';
import {
  CommandConfigData as CommandConfig,
  GuildInfo
} from '@discord-bot/shared-types';
import { catchError, map, Observable, of } from 'rxjs';
import { ApiService } from './api.service';

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

  updateSubcommandConfig(guildId: string, commandId: number, subcommandName: string, updates: unknown): Observable<unknown> {
    return this.apiService.put(`/guilds/${guildId}/commands/${commandId}/${subcommandName}`, updates).pipe(
      map(response => response.success ? response.data || null : null),
      catchError(error => {
        console.error('Failed to update subcommand config:', error);
        return of(null);
      })
    );
  }
}

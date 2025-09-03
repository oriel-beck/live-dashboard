import { inject, Injectable } from '@angular/core';
import {
  CommandConfigResultWithCategory,
  GuildInfo,
} from '@discord-bot/shared-types';
import { catchError, map, Observable, of } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class GuildService {
  private readonly apiService = inject(ApiService);

  getGuildInfo(guildId: string): Observable<GuildInfo | null> {
    return this.apiService.get<GuildInfo>(`/guilds/${guildId}`).pipe(
      map((response) => (response.success ? response.data || null : null)),
      catchError((error) => {
        console.error('Failed to fetch guild info:', error);
        return of(null);
      })
    );
  }

  getGuildCommands(
    guildId: string,
    withSubcommands = false
  ): Observable<Record<string, CommandConfigResultWithCategory>> {
    const params = withSubcommands ? '?withSubcommands=true' : '';
    return this.apiService
      .get<Record<string, CommandConfigResultWithCategory>>(
        `/guilds/${guildId}/commands${params}`
      )
      .pipe(
        map((response) => (response.success ? response.data || {} : {})),
        catchError((error) => {
          console.error('Failed to fetch guild commands:', error);
          return of({});
        })
      );
  }

  updateCommandConfig(
    guildId: string,
    commandId: number,
    updates: Partial<CommandConfigResultWithCategory>
  ): Observable<CommandConfigResultWithCategory | null> {
    return this.apiService
      .put<CommandConfigResultWithCategory>(
        `/guilds/${guildId}/commands/${commandId}`,
        updates
      )
      .pipe(
        map((response) => (response.success ? response.data || null : null)),
        catchError((error) => {
          console.error('Failed to update command config:', error);
          return of(null);
        })
      );
  }

  updateSubcommandConfig(
    guildId: string,
    commandId: number,
    subcommandName: string,
    updates: unknown
  ): Observable<CommandConfigResultWithCategory | null> {
    return this.apiService
      .put<CommandConfigResultWithCategory>(
        `/guilds/${guildId}/commands/${commandId}/${subcommandName}`,
        updates
      )
      .pipe(
        map((response) => (response.success ? response.data || null : null)),
        catchError((error) => {
          console.error('Failed to update subcommand config:', error);
          return of(null);
        })
      );
  }
}

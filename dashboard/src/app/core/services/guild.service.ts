import { inject, Injectable } from '@angular/core';
import { GuildInfo } from '@discord-bot/shared-types';
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
}

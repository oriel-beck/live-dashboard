import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  AuthState,
  User,
  UserGuild,
} from '@discord-bot/shared';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  // Auth state using Angular signals
  private authState = signal<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  // Computed values
  readonly user = computed(() => this.authState().user);
  readonly isAuthenticated = computed(() => this.authState().isAuthenticated);
  readonly isLoading = computed(() => this.authState().isLoading);
  readonly error = computed(() => this.authState().error);
  readonly userGuilds = computed(() => this.authState().user?.guilds || []);

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    // Check if user is already authenticated on app startup
    this.checkAuthStatus().subscribe();
  }

  private updateAuthState(updates: Partial<AuthState>) {
    this.authState.update((current) => ({ ...current, ...updates }));
  }

  // Check current authentication status
  checkAuthStatus(): Observable<boolean> {
    this.updateAuthState({ isLoading: true, error: null });

    return this.apiService.get<User>('/auth/user').pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.updateAuthState({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          this.updateAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      }),
      map((response) => response.success && !!response.data),
      catchError((error) => {
        this.updateAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null, // Don't show error for auth check
        });
        return of(false);
      })
    );
  }

  // Initiate Discord OAuth2 login
  loginWithDiscord() {
    // Redirect to Discord OAuth2 endpoint
    window.location.href = this.apiService.getFullUrl('/auth/discord');
  }

  // Logout user
  logout(): Observable<boolean> {
    this.updateAuthState({ isLoading: true });

    return this.apiService.post('/auth/logout', {}).pipe(
      tap(() => {
        this.updateAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        this.router.navigate(['/']);
      }),
      map((response) => response.success),
      catchError((error) => {
        this.updateAuthState({
          isLoading: false,
          error: 'Failed to logout',
        });
        return of(false);
      })
    );
  }

  // Get user's accessible guilds
  getUserGuilds(): Observable<ApiResponse<UserGuild[]>> {
    return this.apiService.get<UserGuild[]>('/auth/user/guilds').pipe(
      tap((response) => {
        if (response.success && response.data && this.authState().user) {
          this.updateAuthState({
            user: {
              ...this.authState().user!,
              guilds: response.data,
            },
          });
        }
      }),
      catchError((error) => {
        console.error('Failed to fetch user guilds:', error);
        return of({ success: false, data: [] } as ApiResponse<UserGuild[]>);
      })
    );
  }

  // Check if user has access to a specific guild
  hasGuildAccess(guildId: string): boolean {
    const guilds = this.userGuilds();
    return guilds.some((guild) => guild.id === guildId);
  }

  // Get user's permissions for a specific guild
  getGuildPermissions(guildId: string): string | null {
    const guilds = this.userGuilds();
    const guild = guilds.find((g) => g.id === guildId);
    return guild?.permissions || null;
  }

  // Check if user is guild owner
  isGuildOwner(guildId: string): boolean {
    const guilds = this.userGuilds();
    const guild = guilds.find((g) => g.id === guildId);
    return guild?.owner || false;
  }

  // Clear error state
  clearError() {
    this.updateAuthState({ error: null });
  }
}

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Auth guard to protect routes that require authentication
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login page
  router.navigate(['/'], { 
    queryParams: { returnUrl: state.url } 
  });
  return false;
};

// Guild access guard to ensure user has access to specific guild
export const guildAccessGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  const guildId = route.paramMap.get('serverId') || route.paramMap.get('guildId');
  
  if (!guildId) {
    router.navigate(['/servers']);
    return false;
  }

  // Check if user has access to this guild
  if (authService.hasGuildAccess(guildId)) {
    return true;
  }

  // User doesn't have access to this guild
  router.navigate(['/servers'], {
    queryParams: { 
      error: 'You do not have access to this server' 
    }
  });
  return false;
};

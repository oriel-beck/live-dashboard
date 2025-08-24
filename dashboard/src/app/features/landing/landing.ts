import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class Landing implements OnInit {
  authError = '';
  authSuccess = '';

  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Redirect to servers if already authenticated
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.router.navigate(['/servers']);
      }
    });
  }

  ngOnInit() {
    // Check for auth status from query params
    this.route.queryParams.subscribe(params => {
      if (params['auth'] === 'success') {
        this.authSuccess = 'Successfully logged in! Redirecting...';
        // Check auth status to update user data
        this.authService.checkAuthStatus().subscribe();
      } else if (params['auth'] === 'error') {
        this.authError = 'Failed to login with Discord. Please try again.';
      }
    });
  }

  loginWithDiscord() {
    this.authService.loginWithDiscord();
  }

  clearMessages() {
    this.authError = '';
    this.authSuccess = '';
  }

  navigateToServers() {
    this.router.navigate(['/servers']);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.authSuccess = 'Successfully logged out';
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: (error) => {
        this.authError = 'Failed to logout';
        setTimeout(() => this.clearMessages(), 5000);
      }
    });
  }
}

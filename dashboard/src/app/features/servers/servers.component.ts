import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserGuild } from '../../core/models/user.model';

@Component({
  selector: 'app-servers',
  imports: [CommonModule, FormsModule],
  templateUrl: './servers.component.html',
  styleUrls: ['./servers.component.scss']
})
export class ServersComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  error = signal<string>('');
  searchQuery = signal<string>('');

  // Computed values from auth service
  servers = computed(() => this.authService.userGuilds());
  isLoading = computed(() => this.authService.isLoading());
  
  // Filtered servers based on search
  filteredServers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.servers();
    
    return this.servers().filter(server =>
      server.name.toLowerCase().includes(query)
    );
  });

  ngOnInit() {
    // Check for error messages from query params
    this.route.queryParams.subscribe(params => {
      if (params['error']) {
        this.error.set(params['error']);
      }
    });

    // Load user guilds if not already loaded
    if (this.servers().length === 0) {
      this.loadServers();
    }
  }

  loadServers() {
    this.authService.getUserGuilds().subscribe({
      next: () => {
        // Success handled by auth service
      },
      error: (error) => {
        this.error.set('Failed to load your servers. Please try again.');
        console.error('Failed to load guilds:', error);
      }
    });
  }

  navigateToServer(serverId: string) {
    this.router.navigate(['/servers', serverId]);
  }

  navigateToHome() {
    this.router.navigate(['/']);
  }

  logout() {
    this.authService.logout().subscribe();
  }


  clearSearch() {
    this.searchQuery.set('');
  }

  getServerInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }
}

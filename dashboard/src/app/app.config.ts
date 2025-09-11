import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';

import { customDarkTheme } from '../styles/primeng-theme';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    // Required for PrimeNG animations
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: customDarkTheme,
        options: {
          darkModeSelector: '.dark-mode',
        }
      }
    }),
    DialogService
  ]
};

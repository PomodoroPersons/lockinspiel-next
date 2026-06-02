import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHeyApiClient } from '../api-client/client/client.gen';
import { client } from '../api-client/client.gen';
import { provideHttpClient } from '@angular/common/http';
import { AuthSessionService } from './auth-session.service';

client.setConfig({
  baseUrl:
    typeof window !== 'undefined'
      ? window.location.origin
      : typeof Bun !== 'undefined'
        ? Bun.env['BASE_URL']
        : 'https://lockinspiel.live',
  credentials: 'include',
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideClientHydration(withEventReplay()),
    provideHeyApiClient(client),
    provideAppInitializer(async () => {
      await inject(AuthSessionService).initialize();
    }),
  ],
};

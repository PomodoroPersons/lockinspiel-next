import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHeyApiClient } from '../api-client/client/client.gen';
import { client } from '../api-client/client.gen';
import { UserProfileService } from './user-profile/user-profile.service';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { SessionService } from '../api-client';

client.setConfig({
  baseUrl:
    typeof window !== 'undefined'
      ? window.location.origin
      : typeof Bun !== 'undefined'
        ? Bun.env['BASE_URL']
        : 'https://lockinspiel.live',
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHeyApiClient(client),
    provideAppInitializer(async () => {
      const platformId = inject(PLATFORM_ID);
      const httpClient = inject(HttpClient);
      const sessionService = inject(SessionService);
      const userProfileService = inject(UserProfileService);
      if (isPlatformBrowser(platformId)) {
        let { data: accessToken } = await sessionService.authNewSession({
          httpClient,
          body: {
            refresh_token: {},
          },
        });

        client.setConfig({
          auth: accessToken?.access_token,
        });
      }
      await userProfileService.initialize(httpClient);
    }),
  ],
};

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
import { Auth, AuthToken } from '../api-client/core/auth.gen';

client.setConfig({
  baseUrl:
    typeof window !== 'undefined'
      ? window.location.origin
      : typeof Bun !== 'undefined'
        ? Bun.env['BASE_URL']
        : 'https://lockinspiel.live',
});

function extractPayload(payload: string): any {
  return JSON.parse(atob(payload.split('.')[1]))
}

export const authFn = (httpClient: HttpClient, sessionService: SessionService, accessToken: string) => {
  let jwtToken = extractPayload(accessToken);

  return async (auth: Auth): Promise<AuthToken> => {
    if (auth.type === "http" && auth.scheme === "bearer") {
      const now = Date.now() / 1000;

      if (now > jwtToken.exp) {
        let { data: newAccessToken } = await sessionService.authNewSession({
          httpClient,
          body: {
            refresh_token: {},
          },
        });

        if (newAccessToken) {
          accessToken = newAccessToken.access_token;
          jwtToken = extractPayload(newAccessToken.access_token)
        }
      }

      return accessToken
    } else {
      return undefined;
    }
  };
};

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

        if (accessToken)
          client.setConfig({
            auth: authFn(httpClient, sessionService, accessToken.access_token),
          });
      }
      await userProfileService.initialize(httpClient);
    }),
  ],
};

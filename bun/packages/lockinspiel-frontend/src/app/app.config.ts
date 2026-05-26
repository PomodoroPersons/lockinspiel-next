import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHeyApiClient } from '../api-client/client/client.gen';
import { client } from '../api-client/client.gen';
import { SessionService } from '../api-client';

client.setConfig({
  baseUrl: typeof window !== 'undefined' ? window.location.origin : typeof Bun !== 'undefined' ? Bun.env['BASE_URL'] : 'https://lockinspiel.live',
});

let { data: accessToken } = await new SessionService().authNewSession({
  body: {
    refresh_token: {}
  }
});

client.setConfig({
  auth: accessToken?.access_token
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), provideClientHydration(withEventReplay()),
    provideHeyApiClient(client)
  ]
};

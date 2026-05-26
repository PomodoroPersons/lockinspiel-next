import { Component, Inject, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { client } from '../api-client/client.gen';
import { SessionService } from '../api-client';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('lockinspiel-frontend');

  #sessionService = inject(SessionService);
  #http = inject(HttpClient);
  isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit() {
    if (this.isBrowser) {
      let { data: accessToken } = await this.#sessionService.authNewSession({
        httpClient: this.#http,
        body: {
          refresh_token: {}
        }
      });

      client.setConfig({
        auth: accessToken?.access_token
      });
    }
  }
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { client } from '../../api-client/client.gen';
import { HttpClient } from '@angular/common/http';
import { SessionService } from '../../api-client';
import { UserProfileService } from '../user-profile/user-profile.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = signal('');
  password = signal('');
  error = signal('');

  #router = inject(Router)
  #http = inject(HttpClient);
  #sessionService = inject(SessionService);
  #userProfileService = inject(UserProfileService);

  constructor() {
    if (client.getConfig().auth)
      this.#router.navigate(['/home']);
  }

  updateUsername(e: Event) {
    this.username.set((e.target as HTMLInputElement).value);
    this.error.set('');
  }

  updatePassword(e: Event) {
    this.password.set((e.target as HTMLInputElement).value);
    this.error.set('');
  }

  async login() {
    if (!this.username() && !this.password()) {
      this.error.set('Please enter a username and password.');
      return;
    }
    if (!this.username()) {
      this.error.set('Please enter a username.');
      return;
    }
    if (!this.password()) {
      this.error.set('Please enter a password.');
      return;
    }
    const { data, error } = await this.#sessionService.authNewSession({
      httpClient: this.#http,
      body: {
        credentials: {
          username: this.username(),
          password: this.password(),
        }
      }
    });
    if (error) {
      this.error.set(error);
      return;
    }

    client.setConfig({
      auth: data?.access_token,
    });

    await this.#userProfileService.initialize(this.#http);

    this.#router.navigate(['/home']);
  }
}

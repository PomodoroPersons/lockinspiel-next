import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthSessionService } from '../auth-session.service';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
})
export class AuthPage {
  readonly auth = inject(AuthSessionService);

  readonly username = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly message = signal('');

  async login(): Promise<void> {
    this.message.set('');
    this.busy.set(true);
    const ok = await this.auth.login(this.username().trim(), this.password());
    this.busy.set(false);
    this.message.set(ok ? 'Login successful.' : this.auth.lastError() ?? 'Login failed.');
  }

  async signup(): Promise<void> {
    this.message.set('');
    this.busy.set(true);
    const ok = await this.auth.signup(this.username().trim(), this.password());
    this.busy.set(false);
    this.message.set(ok ? 'Account created and session started.' : this.auth.lastError() ?? 'Signup failed.');
  }

  async refreshSession(): Promise<void> {
    this.message.set('');
    this.busy.set(true);
    const ok = await this.auth.refreshFromCookie();
    this.busy.set(false);
    this.message.set(ok ? 'Session refreshed from cookie.' : 'No refresh session was available.');
  }

  async logout(): Promise<void> {
    this.message.set('');
    this.busy.set(true);
    await this.auth.logout();
    this.busy.set(false);
    this.message.set('Logged out.');
  }
}

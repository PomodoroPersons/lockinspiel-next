import { Injectable, computed, signal } from '@angular/core';
import { client } from '../api-client/client.gen';
import { SessionService, UserService } from '../api-client';

type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

const ACCESS_TOKEN_STORAGE_KEY = 'lockinspiel.access_token';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly sessionApi = new SessionService();
  private readonly userApi = new UserService();

  readonly status = signal<AuthStatus>('checking');
  readonly accessToken = signal<string | null>(this.readStoredAccessToken());
  readonly lastError = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.status() === 'authenticated');

  constructor() {
    client.setConfig({
      auth: () => {
        const token = this.accessToken();
        return token ? `Bearer ${token}` : undefined;
      },
    });

    if (this.accessToken()) {
      this.status.set('authenticated');
    }
  }

  async initialize(): Promise<void> {
    await this.refreshFromCookie();
  }

  async signup(username: string, password: string): Promise<boolean> {
    this.lastError.set(null);

    const result = await this.userApi.authSignup({
      body: {
        username,
        password,
      },
    });

    if (result.error || !result.data?.access_token) {
      this.status.set('anonymous');
      this.lastError.set(this.stringifyError(result.error) ?? 'Signup failed');
      return false;
    }

    this.applyAccessToken(result.data.access_token);
    return true;
  }

  async login(username: string, password: string): Promise<boolean> {
    this.lastError.set(null);

    const result = await this.sessionApi.authNewSession({
      body: {
        credentials: {
          username,
          password,
        },
      },
    });

    if (result.error || !result.data?.access_token) {
      this.status.set('anonymous');
      this.lastError.set(this.stringifyError(result.error) ?? 'Login failed');
      return false;
    }

    this.applyAccessToken(result.data.access_token);
    return true;
  }

  async refreshFromCookie(): Promise<boolean> {
    this.lastError.set(null);

    const result = await this.sessionApi.authNewSession({
      body: {
        refresh_token: {},
      },
    });

    if (result.error || !result.data?.access_token) {
      this.clearSession();
      this.status.set('anonymous');
      return false;
    }

    this.applyAccessToken(result.data.access_token);
    return true;
  }

  async logout(): Promise<void> {
    await this.sessionApi.authLogout();
    this.clearSession();
    this.status.set('anonymous');
  }

  private applyAccessToken(token: string): void {
    this.accessToken.set(token);
    this.status.set('authenticated');
    this.persistAccessToken(token);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.persistAccessToken(null);
  }

  private readStoredAccessToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  }

  private persistAccessToken(token: string | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  }

  private stringifyError(error: unknown): string | null {
    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return JSON.stringify(error);
  }
}
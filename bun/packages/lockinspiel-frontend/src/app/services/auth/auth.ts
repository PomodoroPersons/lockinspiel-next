import { inject, Injectable } from '@angular/core';
import {
  AuthDeleteUserErrors,
  AuthDeleteUserResponses,
  AuthInsertableDatabaseUser,
  AuthLogin,
  AuthLoginToken,
  AuthLogoutErrors,
  AuthLogoutResponses,
  AuthNewSessionErrors,
  AuthNewSessionResponses,
  SessionService,
  UserService,
} from '../../../api-client';
import { RequestResult } from '../../../api-client/client';
import { CanActivateFn } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private sessionService = inject(SessionService);
  private userService = inject(UserService);

  private static _authSession?: AuthLoginToken = undefined;

  // Account or User endpoints
  public async createAccount(body: AuthInsertableDatabaseUser) {
    const account = await this.userService.authSignup({ body });
    this.authSession = account.data;
  }

  public async deleteAccount(): RequestResult<
    AuthDeleteUserResponses,
    AuthDeleteUserErrors,
    false,
    'fields'
  > {
    if (!this.authSession) return { data: undefined, error: 'unauthorized' };
    const result = await this.userService.authDeleteUser({
      auth: this.authSession.access_token,
    });
    this.authSession = undefined;
    return result;
  }

  // Session endpoints
  public async createSession(
    body: AuthLogin,
  ): RequestResult<AuthNewSessionResponses, AuthNewSessionErrors, false, 'fields'> {
    const newSession = await this.sessionService.authNewSession({ body });

    if (newSession.error) {
      console.error('could not create a new session', newSession.error);
      return newSession;
    }

    this.authSession = newSession.data;
    return newSession;
  }

  public async logoutAccount(): RequestResult<
    AuthLogoutResponses,
    AuthLogoutErrors,
    false,
    'fields'
  > {
    if (!this.authSession) return { data: undefined, error: 'unauthorized' };
    const result = await this.sessionService.authLogout({
      auth: this.authSession.access_token,
    });
    this.authSession = undefined;
    return result;
  }

  public get authSession() {
    return AuthService._authSession;
  }

  private set authSession(session: AuthLoginToken | undefined) {
    AuthService._authSession = session;
  }

  public canActivate(): boolean {
    return this.authSession !== undefined;
  }
}

export const canActivate: CanActivateFn = () => {
  return inject(AuthService).canActivate();
};

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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private sessionService = inject(SessionService);
  private userService = inject(UserService);

  public authSession?: AuthLoginToken = undefined;

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
    return await this.userService.authDeleteUser({ auth: this.authSession.access_token });
  }

  // Session endpoints
  public async createSession(
    body: AuthLogin,
    auth: AuthLoginToken,
  ): RequestResult<AuthNewSessionResponses, AuthNewSessionErrors, false, 'fields'> {
    if (!this.authSession) return { data: undefined, error: 'unauthorized' };
    return await this.sessionService.authNewSession({ body, auth: auth.access_token });
  }

  public async logoutAccount(): RequestResult<
    AuthLogoutResponses,
    AuthLogoutErrors,
    false,
    'fields'
  > {
    if (!this.authSession) return { data: undefined, error: 'unauthorized' };
    return await this.sessionService.authLogout({ auth: this.authSession.access_token });
  }
}

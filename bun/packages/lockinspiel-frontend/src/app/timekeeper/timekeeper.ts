import { inject, Injectable } from '@angular/core';
import {
  AuthInsertableDatabaseUser,
  AuthLogin,
  AuthLoginToken,
  ProfileService,
  SessionService,
  TagService,
  TimekeeperModifyTagData,
  TimekeeperTag,
  TimekeeperTimer,
  TimekeeperTimeSplit,
  TimekeeperTimeSplitNoTimers,
  TimerService,
  TimeSplitService,
  UserInsertableUserProfile,
  UserPutAvatarQuery,
  UserService,
} from '../../api-client';

@Injectable({
  providedIn: 'root',
})
export class TimekeeperService {
  private sessionService = inject(SessionService);
  private userService = inject(UserService);
  private profileService = inject(ProfileService);
  private timerService = inject(TimerService);
  private tagService = inject(TagService);
  private timeSplitService = inject(TimeSplitService);

  // Account or User endpoints
  public async createAccount(body: AuthInsertableDatabaseUser) {
    return await this.userService.authSignup({ body });
  }

  public async deleteAccount(auth: AuthLoginToken) {
    return await this.userService.authDeleteUser({ auth: auth.access_token });
  }

  // Session endpoints
  public async createSession(body: AuthLogin, auth: AuthLoginToken) {
    return await this.sessionService.authNewSession({ body, auth: auth.access_token });
  }

  public async logoutAccount(auth: AuthLoginToken) {
    return await this.sessionService.authLogout({ auth: auth.access_token });
  }

  // Profile endpoints
  public async createProfile(body: UserInsertableUserProfile, auth: AuthLoginToken) {
    return await this.profileService.userCreateProfile({ body, auth: auth.access_token });
  }

  public async getProfile(auth: AuthLoginToken) {
    return await this.profileService.userGetProfile({ auth: auth.access_token });
  }

  public async updateProfile(body: UserInsertableUserProfile, auth: AuthLoginToken) {
    return await this.profileService.userUpdateProfile({ body, auth: auth.access_token });
  }

  public async replaceProfileAvatar(body: UserPutAvatarQuery, auth: AuthLoginToken) {
    return await this.profileService.userPutAvatar({ body, auth: auth.access_token });
  }

  public async deleteProfileAvatar(auth: AuthLoginToken) {
    return await this.profileService.userDeleteAvatar({ auth: auth.access_token });
  }

  // Time-Split endpoints
  public async createTimeSplit(body: TimekeeperTimeSplit, auth: AuthLoginToken) {
    return await this.timeSplitService.timekeeperAddTimeSplit({ body, auth: auth.access_token });
  }

  public async getTimeSplits(auth: AuthLoginToken) {
    return await this.timeSplitService.timekeeperGetTimeSplits({ auth: auth.access_token });
  }

  public async modifyTimeSplit(
    id: number,
    body: TimekeeperTimeSplitNoTimers,
    auth: AuthLoginToken,
  ) {
    return await this.timeSplitService.timekeeperModifyTimeSplit({
      body,
      auth: auth.access_token,
      path: { id },
    });
  }

  public async deleteTimeSplit(id: number, auth: AuthLoginToken) {
    return await this.timeSplitService.timekeeperDeleteTimeSplit({
      auth: auth.access_token,
      path: { id },
    });
  }

  // Timer endpoints
  public async createTimer(body: TimekeeperTimer, auth: AuthLoginToken) {
    return await this.timerService.timekeeperPostTimer({ body, auth: auth.access_token });
  }

  public async updateTimer(body: TimekeeperTimer, auth: AuthLoginToken) {
    return await this.timerService.timekeeperModifyTimer({ body, auth: auth.access_token });
  }

  public async retrieveTimers(auth: AuthLoginToken) {
    return await this.timerService.timekeeperGetTimers({ auth: auth.access_token });
  }

  // Tag endpoints
  public async createTag(body: TimekeeperTag, auth: AuthLoginToken) {
    return await this.tagService.timekeeperAddTag({ body, auth: auth.access_token });
  }

  public async updateTag(id: number, body: TimekeeperTag, auth: AuthLoginToken) {
    return await this.tagService.timekeeperModifyTag({
      body,
      auth: auth.access_token,
      path: { id },
    });
  }

  public async deleteTag(id: number, auth: AuthLoginToken) {
    return await this.tagService.timekeeperDeleteTag({ auth: auth.access_token, path: { id } });
  }

  public async getTags(auth: AuthLoginToken) {
    return await this.tagService.timekeeperGetTags({ auth: auth.access_token });
  }
}

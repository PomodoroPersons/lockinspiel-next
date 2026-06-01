import { inject, Injectable } from '@angular/core';
import {
  ProfileService,
  TagService,
  TimekeeperTag,
  TimekeeperTimer,
  TimekeeperTimeSplit,
  TimekeeperTimeSplitNoTimers,
  TimekeeperTimeSplitTimer,
  TimekeeperTimeSplitTimerWOrder,
  TimerService,
  TimeSplitService,
  UserInsertableUserProfile,
  UserPutAvatarQuery,
} from '../../../api-client';
import { AuthService } from '../auth/auth';

@Injectable({
  providedIn: 'root',
})
export class TimekeeperService {
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private timerService = inject(TimerService);
  private tagService = inject(TagService);
  private timeSplitService = inject(TimeSplitService);

  // Profile endpoints
  public async createProfile(body: UserInsertableUserProfile) {
    return await this.profileService.userCreateProfile({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async getProfile() {
    return await this.profileService.userGetProfile({ auth: this.auth.authSession?.access_token });
  }

  public async updateProfile(body: UserInsertableUserProfile) {
    return await this.profileService.userUpdateProfile({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async replaceProfileAvatar(body: UserPutAvatarQuery) {
    return await this.profileService.userPutAvatar({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async deleteProfileAvatar() {
    return await this.profileService.userDeleteAvatar({
      auth: this.auth.authSession?.access_token,
    });
  }

  // Time-Split endpoints
  public async createTimeSplit(body: TimekeeperTimeSplit) {
    return await this.timeSplitService.timekeeperAddTimeSplit({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async createTimeSplitTimer(id: number | string, body: TimekeeperTimeSplitTimerWOrder) {
    return await this.timeSplitService.timekeeperPostTimeSplitTimer({
      body,
      auth: this.auth.authSession?.access_token,
      path: { id },
    });
  }

  public async getTimeSplits() {
    return await this.timeSplitService.timekeeperGetTimeSplits({
      auth: this.auth.authSession?.access_token,
    });
  }

  public async modifyTimeSplit(id: number, body: TimekeeperTimeSplitNoTimers) {
    return await this.timeSplitService.timekeeperModifyTimeSplit({
      body,
      auth: this.auth.authSession?.access_token,
      path: { id },
    });
  }

  public async deleteTimeSplit(id: number) {
    return await this.timeSplitService.timekeeperDeleteTimeSplit({
      auth: this.auth.authSession?.access_token,
      path: { id },
    });
  }

  // Timer endpoints
  public async createTimer(body: TimekeeperTimer) {
    return await this.timerService.timekeeperPostTimer({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async updateTimer(body: TimekeeperTimer) {
    return await this.timerService.timekeeperModifyTimer({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async retrieveTimers() {
    return await this.timerService.timekeeperGetTimers({
      auth: this.auth.authSession?.access_token,
    });
  }

  // Tag endpoints
  public async createTag(body: TimekeeperTag) {
    return await this.tagService.timekeeperAddTag({
      body,
      auth: this.auth.authSession?.access_token,
    });
  }

  public async updateTag(id: number, body: TimekeeperTag) {
    return await this.tagService.timekeeperModifyTag({
      body,
      auth: this.auth.authSession?.access_token,
      path: { id },
    });
  }

  public async deleteTag(id: number) {
    return await this.tagService.timekeeperDeleteTag({
      auth: this.auth.authSession?.access_token,
      path: { id },
    });
  }

  public async getTags() {
    return await this.tagService.timekeeperGetTags({ auth: this.auth.authSession?.access_token });
  }
}

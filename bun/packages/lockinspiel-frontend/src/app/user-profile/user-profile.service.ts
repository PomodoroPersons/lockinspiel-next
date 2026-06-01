import { inject, Injectable, signal } from '@angular/core';
import { ProfileService, UserUserProfile } from '../../api-client';
import { HttpClient } from '@angular/common/http';
import { client } from '../../api-client/client.gen';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  public userProfile = signal<UserUserProfile | null>(null);

  #profileService = inject(ProfileService);

  async initialize(httpClient: HttpClient) {
    if (client.getConfig().auth) {
      const { data } = await this.#profileService.userGetProfile({
        httpClient,
      });

      if (data) this.userProfile.set(data);
    }
  }
}

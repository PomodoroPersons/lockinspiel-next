import { Component, inject, signal } from '@angular/core';
import { Timer } from '../timer/timer';
import { SetTimer } from '../set-timer/set-timer';
import { UserProfile, UserData } from '../user-profile/user-profile';
import { SavedList } from '../saved-list/saved-list';
import { FriendList } from '../friend-list/friend-list';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TimekeeperTimeSplit } from '../../api-client';
import { UserProfileService } from '../user-profile/user-profile.service';

@Component({
  selector: 'app-main-page',
  imports: [Timer, SetTimer, UserProfile, SavedList, FriendList, CommonModule, RouterModule],
  templateUrl: './main-page.html',
  styleUrl: './main-page.css',
})
export class MainPage {
  router = inject(Router);
  userProfile = inject(UserProfileService);

  friendsOpen = signal(false);
  savedOpen = signal(false);

  timerRunning = signal<number | null>(0);
  timeSplit = signal<TimekeeperTimeSplit | null>(null);

  modalOpen = signal(false);
  modalUser = signal<UserData>({
    user: this.userProfile.userProfile(),
    isOwn: true,
    status: 'free',
  });

  toggleFriends() {
    this.friendsOpen.set(!this.friendsOpen());
  }

  toggleSaved() {
    this.savedOpen.set(!this.savedOpen());
  }

  openOwnProfile() {
    this.modalUser.set({
      user: this.userProfile.userProfile(),
      isOwn: true,
      status: 'free',
    });
    this.modalOpen.set(true);
  }

  openFriendProfile(user: UserData) {
    this.modalOpen.set(true);
    this.modalUser.set({ ...user, isOwn: false });
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  onTimerStarted(config: TimekeeperTimeSplit) {}

  onTimerStopped() {
    this.timerRunning.set(null);
  }
}

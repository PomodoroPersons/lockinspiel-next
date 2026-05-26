import { Component, inject, signal } from '@angular/core';
import { Timer } from '../timer/timer';
import { SetTimer } from '../set-timer/set-timer';
import { UserProfile, UserData } from '../user-profile/user-profile';
import { SavedList } from '../saved-list/saved-list';
import { FriendList } from '../friend-list/friend-list';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-main-page',
  imports: [Timer, SetTimer, UserProfile, SavedList, FriendList, CommonModule, RouterModule],
  templateUrl: './main-page.html',
  styleUrl: './main-page.css',
})
export class MainPage {
  public router = inject(Router);

  friendsOpen = signal(false);
  savedOpen = signal(false);
  timerRunning = signal(false);
  workMinutes = signal(25);
  restMinutes = signal(5);

  modalOpen = signal(false);
  modalUser = signal<UserData>({
    username: 'Username',
    bio: 'Bio',
    status: 'offline',
    isOwn: true,
  });

  toggleFriends() {
    this.friendsOpen.set(!this.friendsOpen());
  }

  toggleSaved() {
    this.savedOpen.set(!this.savedOpen());
  }

  openOwnProfile() {
    this.modalUser.set({
      username: 'Rollin',
      bio: 'CEO of Frontend',
      status: 'free',
      isOwn: true,
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

  onTimerStarted(config: { workMinutes: number; restMinutes: number }) {
    this.workMinutes.set(config.workMinutes);
    this.restMinutes.set(config.restMinutes);
    this.timerRunning.set(true);
  }

  onTimerStopped() {
    this.timerRunning.set(false);
  }
}

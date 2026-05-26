import { Component, inject, signal } from '@angular/core';
import { Timer } from '../timer/timer';
import { SetTimer } from '../set-timer/set-timer';
import { SavedList } from '../saved-list/saved-list';
import { FriendList } from '../friend-list/friend-list';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserProfileService } from '../user-profile/user-profile.service';

@Component({
  selector: 'app-main-page',
  imports: [Timer, SetTimer, SavedList, FriendList, CommonModule, RouterModule],
  templateUrl: './main-page.html',
  styleUrl: './main-page.css',
})
export class MainPage {
  public router = inject(Router);
  protected userProfile = inject(UserProfileService);

  friendsOpen = signal(false);
  savedOpen = signal(false);
  timerRunning = signal(false);
  workMinutes = signal(25);
  restMinutes = signal(5);

  toggleFriends() {
    this.friendsOpen.set(!this.friendsOpen());
  }

  toggleSaved() {
    this.savedOpen.set(!this.savedOpen());
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

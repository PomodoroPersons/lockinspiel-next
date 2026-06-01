import { Component, inject, signal } from '@angular/core';
import { Timer } from '../timer/timer';
import { SetTimer } from '../set-timer/set-timer';
import { SavedList } from '../saved-list/saved-list';
import { FriendList } from '../friend-list/friend-list';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TimekeeperTimeSplit } from '../../api-client';

@Component({
  selector: 'app-main-page',
  imports: [Timer, SetTimer, SavedList, FriendList, CommonModule, RouterModule],
  templateUrl: './main-page.html',
  styleUrl: './main-page.css',
})
export class MainPage {
  router = inject(Router);

  friendsOpen = signal(false);
  savedOpen = signal(false);

  timerRunning = signal<number | null>(0);
  timeSplit = signal<TimekeeperTimeSplit | null>(null);

  toggleFriends() {
    this.friendsOpen.set(!this.friendsOpen());
  }

  toggleSaved() {
    this.savedOpen.set(!this.savedOpen());
  }

  onTimerStarted(config: TimekeeperTimeSplit) {}

  onTimerStopped() {
    this.timerRunning.set(null);
  }
}

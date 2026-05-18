import { Component, signal } from '@angular/core';
import { Timer } from '../timer/timer';
import { SetTimer } from '../set-timer/set-timer';
import { UserProfile } from '../user-profile/user-profile';
import { SavedList } from '../saved-list/saved-list';
import { FriendList } from '../friend-list/friend-list';
import { Setting } from '../setting/setting';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-page',
  imports: [Timer, SetTimer, UserProfile, SavedList, FriendList, Setting, CommonModule],
  templateUrl: './main-page.html',
  styleUrl: './main-page.css',
})
export class MainPage {
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

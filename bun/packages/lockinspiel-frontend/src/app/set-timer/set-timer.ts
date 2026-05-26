import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-set-timer',
  imports: [CommonModule],
  templateUrl: './set-timer.html',
  styleUrl: './set-timer.css',
})
export class SetTimer {
  favorited = signal(false);
  friendsPanelOpen = signal(false);

  timerStarted = output<void>();

  toggleFavorite() {
    this.favorited.set(!this.favorited());
  }

  toggleFriendsPanel() {
    this.friendsPanelOpen.set(!this.friendsPanelOpen());
  }

  startTimer() {
    this.timerStarted.emit();
  }
}

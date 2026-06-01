import { Component, OnDestroy, output, input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimekeeperTimeSplit } from '../../api-client';
import { TimekeeperService } from '../services/timekeeper/timekeeper';

@Component({
  selector: 'app-timer',
  imports: [CommonModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css',
})
export class Timer implements OnDestroy {
  private timekeeper = inject(TimekeeperService);

  timerStopped = output<void>();

  timers = input<TimekeeperTimeSplit['timers']>([]);
  timerRunning = input<number | null>(null);
  timerPaused = signal<boolean>(true);

  private static readonly minutesToMs = 60 * 1000;

  displayTime = computed(() => {
    const ms = this.remainingMs();
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  remainingMs() {
    return 25 * Timer.minutesToMs;
  }

  toggleTimerState() {
    if (this.timerRunning() == null) return;

    // I need the timesheet!!!!
    this.timerPaused.set(!this.timerPaused());
  }

  stop() {}

  timerType(): 'work' | 'rest' | 'unknown' {
    if (this.timerRunning() === null) return 'unknown';

    if (this.timers()[this.timerRunning()!].work) {
      return 'work';
    } else {
      return 'rest';
    }
  }

  ngOnDestroy() {}
}

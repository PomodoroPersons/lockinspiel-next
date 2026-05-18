import { Component, signal, computed, OnDestroy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timer',
  imports: [CommonModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css',
})
export class Timer implements OnDestroy {
  workMinutes = input<number>(25);
  restMinutes = input<number>(5);

  timerStopped = output<void>();

  mode = signal<'work' | 'rest'>('work');
  running = signal(false);
  timerEndMs = signal<number | null>(null);
  pausedRemainingMs = signal<number | null>(null);
  remainingMs = signal(25 * 60 * 1000);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  displayTime = computed(() => {
    const ms = this.remainingMs();
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  start() {
    if (this.running()) return;
    const ms = this.pausedRemainingMs() ?? this.remainingMs();
    this.timerEndMs.set(Date.now() + ms);
    this.pausedRemainingMs.set(null);
    this.running.set(true);

    this.intervalId = setInterval(() => {
      const remaining = this.timerEndMs()! - Date.now();
      if (remaining <= 0) {
        this.remainingMs.set(0);
        this.timerFinished();
      } else {
        this.remainingMs.set(remaining);
      }
    }, 100);
  }

  pause() {
    if (!this.running()) return;
    this.pausedRemainingMs.set(this.remainingMs());
    this.running.set(false);
    this.clearInterval();
  }

  stop() {
    this.running.set(false);
    this.pausedRemainingMs.set(null);
    this.timerEndMs.set(null);
    this.clearInterval();
    this.mode.set('work');
    this.remainingMs.set(this.workMinutes() * 60 * 1000);
    this.timerStopped.emit();
  }

  private timerFinished() {
    this.clearInterval();
    this.running.set(false);
    if (this.mode() === 'work') {
      this.mode.set('rest');
      this.remainingMs.set(this.restMinutes() * 60 * 1000);
    } else {
      this.mode.set('work');
      this.remainingMs.set(this.workMinutes() * 60 * 1000);
    }
  }

  private clearInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  ngOnDestroy() {
    this.clearInterval();
  }
}

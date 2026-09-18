import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

const TIMER_DURATION_MS = 25 * 60 * 1000;

@Component({
  selector: 'timer',
  templateUrl: './timer.html',
  styleUrl: './timer.css',
  imports: [MatProgressSpinnerModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimerComponent {
  private readonly remainingMs = signal(TIMER_DURATION_MS);
  private deadline = 0;
  private intervalId: ReturnType<typeof setInterval> | undefined;

  protected readonly state = signal<'ready' | 'running' | 'paused' | 'complete'>('ready');
  protected readonly time = computed(() => {
    const seconds = Math.ceil(this.remainingMs() / 1000);
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  });
  protected readonly progress = computed(() => (this.remainingMs() / TIMER_DURATION_MS) * 100);
  protected readonly actionLabel = computed(() => {
    switch (this.state()) {
      case 'running':
        return 'Pause the timer';
      case 'paused':
        return 'Resume the timer';
      case 'complete':
        return 'Start a new 25 minute timer';
      default:
        return 'Start the timer';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopInterval());
  }

  protected toggle(): void {
    if (this.state() === 'running') {
      this.updateRemaining();
      this.stopInterval();
      if (this.state() !== 'complete') this.state.set('paused');
      return;
    }

    if (this.state() === 'complete') this.remainingMs.set(TIMER_DURATION_MS);
    this.deadline = Date.now() + this.remainingMs();
    this.state.set('running');
    this.intervalId = setInterval(() => this.updateRemaining(), 250);
  }

  protected reset(): void {
    this.stopInterval();
    this.remainingMs.set(TIMER_DURATION_MS);
    this.state.set('ready');
  }

  private updateRemaining(): void {
    // A deadline keeps delayed background-tab callbacks from extending the timer.
    const remaining = Math.max(0, this.deadline - Date.now());
    this.remainingMs.set(remaining);
    if (remaining === 0) {
      this.stopInterval();
      this.state.set('complete');
    }
  }

  private stopInterval(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

import {
  Component,
  OnDestroy,
  output,
  input,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimekeeperTimer, TimekeeperTimeSplit, TimekeeperTimeSplitWid } from '../../api-client';
import { TimekeeperService } from '../services/timekeeper/timekeeper';

@Component({
  selector: 'app-timer',
  imports: [CommonModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css',
})
export class Timer implements OnInit, OnDestroy {
  private timekeeper = inject(TimekeeperService);

  timerStopped = output<void>();

  timeSplit = input<TimekeeperTimeSplitWid | null>(null);
  timerPaused = signal<boolean>(true);
  currentTimer = signal<number | string | null>(null);
  private currentTimeSplitTimer = signal<number>(0);
  private timerStack: TimekeeperTimer[] = [];
  private remainingMs = signal<number>(0);

  private static readonly MINUTE_TO_MS = 60 * 1000;

  displayTime = computed(() => {
    const ms = this.remainingMs();
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  async ngOnInit() {
    const split = this.timeSplit()!;
    if (!split) {
      console.warn('no time split defined');
      return;
    }

    const allTimers = (await this.timekeeper.retrieveTimers()).data;
    if (!allTimers) {
      console.error('user timers should not be undefined');
      return;
    }

    this.timerStack = allTimers.filter((t) => t.time_split == split.id);
  }

  async toggleTimerState() {
    const split = this.timeSplit()!;
    if (!split || split.timers.length <= 0) {
      console.warn('no time split defined');
      return;
    }

    const currentTimer = this.currentTimer();
    const currentSplitTimer = this.currentTimeSplitTimer();
    if (currentTimer === null) {
      const firstTimer = split.timers[0];
      const timer = await this.timekeeper.createTimer({
        time_split: split.id,
        time_split_timer: currentSplitTimer,
        start_time: Date.now(),
        end_time: Date.now() + this.endTimeUnix(firstTimer.len),
        tags: [],
        work: firstTimer.work,
      });

      if (timer.error) {
        console.error(timer.error);
        return;
      }

      this.timerStack.push(timer.data);
      this.currentTimeSplitTimer.set(0);
      this.currentTimer.set(timer.data.time_split_timer);
      return;
    }

    if (this.timerPaused()) {
      this.resume(split, currentSplitTimer);
    } else {
      this.pause(split, currentSplitTimer);
    }
  }

  stop() {
    this.timerStopped.emit();
  }

  timerType(): 'work' | 'rest' | 'unknown' {
    const split = this.timeSplit();
    if (!split) return 'unknown';

    if (split.timers[this.getId(this.currentTimeSplitTimer())].work) {
      return 'work';
    } else {
      return 'rest';
    }
  }

  private async resume(split: TimekeeperTimeSplitWid, currentSplitTimer: number) {
    const timer = await this.timekeeper.createTimer({
      time_split: split.id,
      time_split_timer: split.timers[currentSplitTimer].id,
      start_time: Date.now(),
      end_time: Date.now() + this.remainingMs(),
      tags: [],
      work: split.timers[currentSplitTimer].work,
    });

    if (timer.error) {
      console.error(timer.error);
      return;
    }

    this.timerPaused.set(true);
    this.timerStack.push(timer.data);
    this.currentTimer.set(timer.data.time_split_timer);
  }

  private async pause(split: TimekeeperTimeSplitWid, currentSplitTimer: number) {
    const originalEndTime = this.getTimestamp(this.timerStack.at(-1)!.end_time);
    if (!originalEndTime) return;
    this.remainingMs.set(originalEndTime - Date.now());

    this.timerStack.at(-1)!.end_time = Date.now();
    const timer = await this.timekeeper.createTimer({
      time_split: split.id,
      time_split_timer: split.timers[currentSplitTimer].id,
      start_time: this.timerStack.at(-1)!.start_time,
      end_time: Date.now(),
      tags: [],
      work: split.timers[currentSplitTimer].work,
    });

    if (timer.error) {
      console.error(timer.error);
      return;
    }

    this.timerPaused.set(false);
    this.currentTimer.set(timer.data.time_split_timer);
  }

  private endTimeUnix(len: number | string) {
    const minutes = typeof len === 'number' ? len : parseInt(len);
    return minutes * Timer.MINUTE_TO_MS;
  }

  private getId(id: number | string): number {
    return typeof id === 'number' ? id : parseInt(id);
  }

  private getTimestamp(time: unknown): number | undefined {
    switch (typeof time) {
      case 'number':
        return time;
      case 'string':
        return parseInt(time);
      default:
        console.error('type of timestamp not accepted', typeof time);
        return undefined;
    }
  }

  ngOnDestroy() {
    const split = this.timeSplit()!;

    if (!split || split.timers.length <= 0) {
      console.warn('no time split defined');
      return;
    }

    const currentSplitTimer = this.currentTimeSplitTimer();

    this.pause(split, currentSplitTimer);
    this.stop();
  }
}

import { NgIcon, provideIcons } from '@ng-icons/core';
import { phosphorPlayFill, phosphorShareFill, phosphorPauseFill, phosphorStopFill } from '@ng-icons/phosphor-icons/fill';
import { Component, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { TimekeeperTimer, TimekeeperTimeSplitWid, TimerService, TimeSplitService, TimeSyncService } from '../../api-client';
import { HttpClient } from '@angular/common/http';
import { UserProfileService } from '../user-profile/user-profile.service';

function getTime(time: Date | string | number) {
  if (time instanceof Date)
    return time.getTime();
  else if (typeof time === "number")
    return time;
  else {
    const num = Number(time);
    return Number.isNaN(num) ? new Date(time).getTime() : num;
  }
}

async function getClockOffset(client: TimeSyncService, httpClient: HttpClient) {
  const results = [];
  for (let i = 0; i < 3; i++) {
    // Timestamps returned by timesync service have
    // microsecond precision
    const n1 = Date.now() * 1000;
    const { data, error } = await client.timesyncGetN2N3({
      httpClient
    });
    const n4 = Date.now() * 1000;

    if (error)
      console.error(error)

    if (data) {
      const { n2, n3 } = data;
      results.push(((n2 - n1) + (n3 - n4)) / 2);
    }
  }
  results.sort((a, b) => a - b);
  if (results.length == 0)
    return 0;
  return results[Math.floor(results.length / 2)] / 1000;
}

@Component({
  selector: 'app-timer',
  imports: [CommonModule, NgIcon, ClipboardModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css',
  viewProviders: [provideIcons({ phosphorPlayFill, phosphorShareFill, phosphorPauseFill, phosphorStopFill })]
})
export class Timer implements OnDestroy {
  #http = inject(HttpClient);
  #timeSync = inject(TimeSyncService);
  #timerService = inject(TimerService);
  #timeSplitService = inject(TimeSplitService);
  #userProfile = inject(UserProfileService);
  clockOffset = 0;

  timers = signal<TimekeeperTimeSplitWid[]>([]);
  timeSplit = signal<TimekeeperTimeSplitWid | null>(null);
  timerRunning = signal<TimekeeperTimer | null>(null);

  remainingMsInterval: any = null;
  remainingMs = signal<number>(0);
  displayTime = computed(() => {
    const ms = this.remainingMs();
    const totalSeconds = ms ? Math.max(0, Math.ceil(ms / 1000)) : 0;
    const minutes = ms ? Math.floor(totalSeconds / 60) : 0;
    const seconds = ms ? totalSeconds % 60 : 0;
    return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
  });
  sharableLink = computed(() => {
    const runningTimer = this.timerRunning();
    const userProfile = this.#userProfile.userProfile();
    if (runningTimer && userProfile)
      return `${window.location.origin}/home?user_id=${userProfile.user_id}&timer_start_time=${runningTimer.start_time}`
    return null
  });

  constructor() {
    this.remainingMsInterval = setInterval(() => {
      const timerRunning = this.timerRunning();
      if (timerRunning)
        this.remainingMs.set(getTime(timerRunning.end_time) - this.now());
      else
        this.remainingMs.set(0);
    }, 50);
  }

  now() {
    return Date.now() - this.clockOffset;
  }

  startTimeSplit(timeSplit: TimekeeperTimeSplitWid) {
    const timer = timeSplit.timers[0];
    this.startTimer(timer);
  }

  async startTimer(timer: TimekeeperTimeSplitWid['timers'][number]) {
    const start_time = this.now();
    const end_time = start_time + Number(timer.len) * 1000;

    const { data, error } = await this.#timerService.timekeeperPostTimer({
      body: {
        start_time,
        end_time,
        tags: [],
        time_split_timer: timer.id
      },
    });

    if (data)
      this.timerRunning.set(data)

    if (error)
      console.error(error)
  }

  timerPaused() {
    const timeSplit = this.timeSplit();
    const timerRunning = this.timerRunning();

    if (timeSplit && timerRunning)
      return getTime(timerRunning.end_time) <= this.now();

    return true;
  }

  toggleTimerState() {
    if (this.timerRunning() == null) {
      const pomodoroTimeSplit = this.timers()[0];
      this.startTimeSplit(pomodoroTimeSplit);
    }
  }

  async stop() {
    const end_time = this.now();
    const timerRunning = this.timerRunning();

    if (timerRunning) {
      const { data, error } = await this.#timerService.timekeeperModifyTimer({
        body: {
          start_time: timerRunning.start_time,
          end_time,
          tags: timerRunning.tags,
          time_split_timer: timerRunning.time_split_timer
        }
      });

      if (data)
        this.timerRunning.update(timer => {
          if(timer)
            timer.end_time = end_time;
          return timer
        })

      if (error)
        console.error(error)
    }
  }

  timerType(): 'work' | 'rest' | 'unknown' {
    const timerRunning = this.timerRunning();

    if (timerRunning)
      return timerRunning.work ? 'work' : 'rest';

    return 'unknown';
  }

  async ngOnInit() {
    this.clockOffset = await getClockOffset(this.#timeSync, this.#http);

    const { data: timeSplitData, error: timeSplitError } = await this.#timeSplitService.timekeeperGetTimeSplits({
      httpClient: this.#http
    });

    if (timeSplitError)
      console.error(timeSplitError);

    if (timeSplitData)
      this.timers.set(timeSplitData);

    const parameters = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
    const { data: timerData, error: timerError } = await this.#timerService.timekeeperGetTimers({
      httpClient: this.#http,
      query: parameters ? {
        timer_start_time: parameters.get("timer_start_time") ?? undefined,
        user_id: parameters.get("user_id") ?? undefined
      } : undefined
    });

    if (timerError)
      console.error(timerError);

    if (timerData && timerData[0] && getTime(timerData[0].end_time) > this.now())
      this.timerRunning.set(timerData[0])
  }

  ngOnDestroy() {
    clearInterval(this.remainingMsInterval);
  }
}

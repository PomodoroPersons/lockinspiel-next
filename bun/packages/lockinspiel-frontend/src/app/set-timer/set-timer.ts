import { Component, signal, output, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TimekeeperTimeSplitTimerWOrder, TimekeeperTimeSplitWid } from '../../api-client';
import { TimekeeperService } from '../services/timekeeper/timekeeper';

@Component({
  selector: 'app-set-timer',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './set-timer.html',
  styleUrl: './set-timer.css',
})
export class SetTimer {
  private timekeeper = inject(TimekeeperService);

  timeSplitGroup = new FormGroup({
    name: new FormControl<string>('', [Validators.minLength(1), Validators.required]),
    description: new FormControl<string | null>(null),
    workTime: new FormControl<number | null>(null, [
      Validators.min(1),
      Validators.pattern(/^\d+$/),
      Validators.required,
    ]),
    restTime: new FormControl<number | null>(null, [
      Validators.min(1),
      Validators.pattern(/^\d+$/),
      Validators.required,
    ]),
  });

  friendsPanelOpen = signal(false);

  timerStarted = output<TimekeeperTimeSplitWid>();

  toggleFriendsPanel() {
    this.friendsPanelOpen.set(!this.friendsPanelOpen());
  }

  async startTimer() {
    if (this.timeSplitGroup.invalid) {
      console.warn('invalid form values', this.timeSplitGroup.controls);
      return;
    }

    const controls = this.timeSplitGroup.controls;
    const timeSplit = {
      name: controls.name.value!,
      description: controls.description.value!,
      timers: <TimekeeperTimeSplitTimerWOrder[]>[
        {
          order_idx: 0,
          len: controls.workTime.value!,
          name: 'Work',
          work: true,
        },
        {
          order_idx: 1,
          len: controls.restTime.value!,
          name: 'Rest',
          work: false,
        },
      ],
    };

    const id = await this.timekeeper.createTimeSplit(timeSplit);
    if (id.error) {
      console.error('an error ocurred while trying to make the time split', id.error);
      return;
    }

    const timeSplitTimers = await Promise.all(
      timeSplit.timers.map(async (t) => {
        const timer = await this.timekeeper.createTimeSplitTimer(id.data.time_split_id, t);
        return timer.data!;
      }),
    );

    this.timerStarted.emit({
      id: id.data.time_split_id,
      name: timeSplit.name,
      description: timeSplit.description,
      timers: timeSplitTimers,
    });
  }
}

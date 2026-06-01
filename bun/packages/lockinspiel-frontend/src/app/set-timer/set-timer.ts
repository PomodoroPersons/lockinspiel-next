import { Component, signal, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TimekeeperTimeSplit } from '../../api-client';

@Component({
  selector: 'app-set-timer',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './set-timer.html',
  styleUrl: './set-timer.css',
})
export class SetTimer {
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

  timerStarted = output<TimekeeperTimeSplit>();

  toggleFriendsPanel() {
    this.friendsPanelOpen.set(!this.friendsPanelOpen());
  }

  startTimer() {
    if (this.timeSplitGroup.invalid) {
      console.warn('invalid form values', this.timeSplitGroup.controls);
      return;
    }

    const controls = this.timeSplitGroup.controls;
    const timeSplit = {
      name: controls.name.value!,
      description: controls.description.value!,
      timers: [
        {
          len: controls.workTime.value!,
          name: '',
          work: true,
        },
        {
          len: controls.restTime.value!,
          name: '',
          work: false,
        },
      ],
    };

    // this.timekeeper.createTimeSplit(timeSplit);
    this.timerStarted.emit(timeSplit);
  }
}

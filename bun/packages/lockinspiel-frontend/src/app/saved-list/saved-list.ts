import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type View = 'main' | 'delete';

interface SavedTimer {
  id: number;
  workMinutes: number;
  restMinutes: number;
}

@Component({
  selector: 'app-saved-list',
  imports: [CommonModule],
  templateUrl: './saved-list.html',
  styleUrl: './saved-list.css',
})
export class SavedList {
  view = signal<View>('main');

  timers = signal<SavedTimer[]>([
    { id: 1, workMinutes: 25, restMinutes: 5 },
    { id: 2, workMinutes: 50, restMinutes: 10 },
    { id: 3, workMinutes: 90, restMinutes: 20 },
  ]);

  setView(v: View) {
    this.view.set(v);
  }

  deleteTimer(id: number) {
    this.timers.update((list) => list.filter((t) => t.id !== id));
  }
}

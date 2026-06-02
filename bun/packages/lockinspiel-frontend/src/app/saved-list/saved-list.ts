import { Component, inject, Pipe, PipeTransform, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimekeeperTimeSplitWid, TimeSplitService } from '../../api-client';
import { HttpClient } from '@angular/common/http';

type View = 'main' | 'delete';

@Pipe({
  name: 'asInterval'
})
export class AsInterval implements PipeTransform {
  transform(value: string | number): string {
    return `${Number(value) / 60}:${(Number(value) % 60).toString().padStart(2, '0')}`;
  }
}

@Component({
  selector: 'app-saved-list',
  imports: [CommonModule, AsInterval],
  templateUrl: './saved-list.html',
  styleUrl: './saved-list.css',
})
export class SavedList {
  view = signal<View>('main');
  timers = signal<TimekeeperTimeSplitWid[]>([]);

  #http = inject(HttpClient);
  #timeSplitService = inject(TimeSplitService);

  setView(v: View) {
    this.view.set(v);
  }

  deleteTimer(id: string | number) {
    this.timers.update((list) => list.filter((t) => t.id !== id));
  }

  async ngOnInit() {
    // const { data, error } = await this.#timeSplitService.timekeeperGetTimeSplits({
    //   httpClient: this.#http
    // });

    // if (error)
    //   console.error(error)

    // if (data)
    //   this.timers.set(data)
  }
}

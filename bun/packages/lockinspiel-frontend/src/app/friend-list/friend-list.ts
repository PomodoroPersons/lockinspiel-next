import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type View = 'main' | 'add' | 'mail';

@Component({
  selector: 'app-friend-list',
  imports: [CommonModule],
  templateUrl: './friend-list.html',
  styleUrl: './friend-list.css',
})
export class FriendList {
  view = signal<View>('main');
  addUsername = signal('');

  friends = [
    { id: 1, username: 'Isaac Mills' },
    { id: 2, username: 'Arthur Grover' },
    { id: 3, username: 'Makaden Espinosa' },
  ];

  invites = [
    { id: 1, username: 'Marz123!' },
    { id: 2, username: 'PomoFan99' },
  ];

  setView(v: View) {
    this.view.set(v);
  }
}

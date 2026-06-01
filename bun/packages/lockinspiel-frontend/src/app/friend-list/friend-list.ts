import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserData } from '../user-profile/user-profile';

type View = 'main' | 'add' | 'mail';

@Component({
  selector: 'app-friend-list',
  imports: [CommonModule],
  templateUrl: './friend-list.html',
  styleUrl: './friend-list.css',
})
export class FriendList {
  view = signal<View>('main');

  profileClicked = output<UserData>();

  friends = [
    { id: 1, username: 'Isaac Mills', bio: 'CEO of Scrum', status: 'free' as const },
    { id: 2, username: 'Arthur Grover', bio: 'CEO of Timekeeping', status: 'busy' as const },
    { id: 3, username: 'Makaden Espinosa', bio: 'CEO of Statistics', status: 'dnd' as const },
  ];

  invites = [
    { id: 1, username: 'Marz123' },
    { id: 2, username: 'PomoFan99' },
  ];

  setView(v: View) {
    this.view.set(v);
  }

  openProfile(friend: (typeof this.friends)[0]) {
    this.profileClicked.emit({
      user: {
        display_name: friend.username,
        bio: friend.bio,
      },
      status: friend.status,
      isOwn: false,
    });
  }
}

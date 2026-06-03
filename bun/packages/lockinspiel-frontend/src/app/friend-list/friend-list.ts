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
    { user_id: '019e8e0a-9ecb-7c2f-a45b-7c7765176bb1', username: 'Isaac Mills', bio: 'CEO of Scrum', status: 'free' as const },
    { user_id: '019e8e0a-be44-7857-be65-b203f955d1ea', username: 'Arthur Grover', bio: 'CEO of Timekeeping', status: 'busy' as const },
    { user_id: '019e8e0a-d84d-7b92-9c54-35ba5d849a1e', username: 'Makaden Espinosa', bio: 'CEO of Statistics', status: 'dnd' as const },
  ];

  invites = [
    { user_id: '019e8e0a-f3b8-7b1b-b7b3-9c1cef760979', username: 'Marz123' },
    { user_id: '019e8e0b-0f0c-77fc-b922-c2d2fd2aa36a', username: 'PomoFan99' },
  ];

  setView(v: View) {
    this.view.set(v);
  }

  openProfile(friend: (typeof this.friends)[0]) {
    this.profileClicked.emit({
      user: {
        user_id: friend.user_id,
        display_name: friend.username,
        bio: friend.bio,
      },
      status: friend.status,
      isOwn: false,
    });
  }
}

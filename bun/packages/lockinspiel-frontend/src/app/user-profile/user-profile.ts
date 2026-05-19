import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserUserProfile } from '../../api-client';

export interface UserData {
  user: UserUserProfile | null;
  isOwn: boolean;
  status: 'free' | 'busy' | 'dnd' | 'offline';
}

@Component({
  selector: 'app-user-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfile {
  user = input.required<UserData>();
  closed = output<void>();
  applied = output<UserData>();

  editUsername = signal('');
  editBio = signal('');
  editStatus = signal<UserData['status']>('free');

  statuses: UserData['status'][] = ['free', 'busy', 'dnd', 'offline'];

  ngOnInit() {
    const user = this.user()
    if (user.user) {
      this.editUsername.set(user.user.display_name);
      this.editBio.set(user.user.bio);
      this.editStatus.set(user.status);
    }
  }

  statusColor(status: UserData['status']): string {
    switch (status) {
      case 'free':
        return '#4ade80';
      case 'busy':
        return '#facc15';
      case 'dnd':
        return '#f87171';
      case 'offline':
        return '#6b7280';
    }
  }

  cancel() {
    this.closed.emit();
  }

  apply() {
    this.applied.emit({
      user: {
        display_name: this.editUsername(),
        bio: this.editBio(),
      },
      status: this.editStatus(),
      isOwn: true,
    });
    this.closed.emit();
  }
}

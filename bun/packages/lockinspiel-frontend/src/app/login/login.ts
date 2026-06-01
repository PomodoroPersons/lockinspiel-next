import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private router = inject(Router);

  username = signal('');
  password = signal('');
  error = signal('');

  updateUsername(e: Event) {
    this.username.set((e.target as HTMLInputElement).value);
    this.error.set('');
  }

  updatePassword(e: Event) {
    this.password.set((e.target as HTMLInputElement).value);
    this.error.set('');
  }

  login() {
    if (!this.username() && !this.password()) {
      this.error.set('Please enter a username and password.');
      return;
    }
    if (!this.username()) {
      this.error.set('Please enter a username.');
      return;
    }
    if (!this.password()) {
      this.error.set('Please enter a password.');
      return;
    }
    if (this.username() !== 'username' || this.password() !== 'password') {
      this.error.set('Incorrect username or password.');
      return;
    }
    this.router.navigate(['/home']);
  }
}

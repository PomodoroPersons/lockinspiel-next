import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth/auth';
import {
  FormControl,
  FormGroup,
  FormsModule,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  loginGroup = new FormGroup({
    username: new FormControl<string>('', [Validators.required, Validators.min(1)]),
    password: new FormControl<string>('', [Validators.required, Validators.min(1)]),
  });

  error = signal<string | null>(null);

  async login() {
    const username = this.loginGroup.controls.username;
    const password = this.loginGroup.controls.password;
    this.setLoginErrors(username, password);

    if (this.loginGroup.invalid) return;

    const result = await this.auth.createSession({
      credentials: {
        username: username.value!,
        password: password.value!,
      },
    });

    if (result.error) {
      this.error.set('Wrong username or password');
      return;
    }

    this.router.navigate(['/home']);
  }

  async signUp() {
    const username = this.loginGroup.controls.username;
    const password = this.loginGroup.controls.password;
    this.setLoginErrors(username, password);

    if (this.loginGroup.invalid) return;

    await this.auth.createAccount({
      username: username.value!,
      password: password.value!,
    });
    this.router.navigate(['/home']);
  }

  private setLoginErrors(
    username: FormControl<string | null>,
    password: FormControl<string | null>,
  ) {
    if (username.invalid && password.invalid) {
      this.error.set('Please enter a username and password.');
    } else if (username.invalid) {
      this.error.set('Please enter a username.');
    } else if (password.invalid) {
      this.error.set('Please enter a password.');
    } else {
      this.error.set(null);
    }
  }
}

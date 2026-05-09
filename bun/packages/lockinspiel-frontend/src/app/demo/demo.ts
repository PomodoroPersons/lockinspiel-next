import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import { TimersService, TimekeeperPostTimekeeperTimerErrors, TimekeeperGetTimekeeperTimerErrors, TimekeeperTimerWid, UsersService, AuthSignupErrors } from '../../api-client'

@Component({
  host: { ngSkipHydration: 'true' },
  imports: [JsonPipe],
  selector: 'app-demo',
  template: `
    <button (click)="onGetTimerById()" type="button">Get Random Timer</button>

    @if (error()) {
      <div class="error-message">
        <div class="error-title">Error occurred:</div>
        <div class="error-details">{{ error()?.error | json }}</div>
      </div>
    }
    @if (timer()) {
      <div class="timer-card">
        <div class="timer-info">
          {{ timer() | json }}
        </div>
      </div>
    }
  `
})
export class Demo {
  timer = signal<TimekeeperTimerWid[] | undefined>(undefined);
   error = signal<
    | undefined
    | {
        error: TimekeeperGetTimekeeperTimerErrors[keyof TimekeeperGetTimekeeperTimerErrors]
          | TimekeeperPostTimekeeperTimerErrors[keyof TimekeeperPostTimekeeperTimerErrors]
          | AuthSignupErrors[keyof AuthSignupErrors]
          | Error;
        response: HttpErrorResponse;
      }
  >(undefined);

  #timerService = inject(TimersService);
  #userService = inject(UsersService);
  #http = inject(HttpClient);

  onGetTimerById = async () => {
    let jwt;
    {
      const { data, error, response } = await this.#userService.authLogin({
        httpClient: this.#http,
        body: {
          username: "johndoe",
          password: "password"
        }
      });

      if (error) {
        console.log(error);
        this.error.set({
          error,
          response: response as HttpErrorResponse,
        });
        return;
      } else {
        console.log(error);
        console.log(response);
        jwt = data;
        this.error.set(undefined);
      }
    }
    {
      const { data, error, response } = await this.#timerService.timekeeperPostTimekeeperTimer({
        httpClient: this.#http,
        body: {
          start_timestamp: Date.now(),
          end_timestamp: Date.now() + 3600,
          tags: [],
          time_split: 1,
          work: true
        },
        auth() {
          console.log(jwt?.access_token)
          return jwt?.access_token
        }
        // auth: jwt?.access_token
      });

      if (error) {
        console.log(error);
        this.error.set({
          error,
          response: response as HttpErrorResponse,
        });
        return;
      } else {
        console.log(error);
        console.log(response);
        this.error.set(undefined);
      }
    }
    const { data, error, response } = await this.#timerService.timekeeperGetTimekeeperTimer({
      httpClient: this.#http,
      auth: jwt?.access_token
    });

    if (error) {
      console.log(error);
      this.error.set({
        error,
        response: response as HttpErrorResponse,
      });
      return;
    } else {
      console.log(error);
      console.log(response);
      this.timer.set(data);
      this.error.set(undefined);
    }
  };
}

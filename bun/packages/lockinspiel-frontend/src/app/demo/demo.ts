import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { JsonPipe } from '@angular/common';
import {
  TimerService,
  TimekeeperPostTimerErrors,
  TimekeeperGetTimersErrors,
  TimekeeperTimer,
  AuthNewSessionErrors,
  SessionService,
} from '../../api-client';

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
  `,
})
export class Demo {
  timer = signal<TimekeeperTimer[] | undefined>(undefined);
  error = signal<
    | undefined
    | {
        error:
          | TimekeeperGetTimersErrors[keyof TimekeeperGetTimersErrors]
          | TimekeeperPostTimerErrors[keyof TimekeeperPostTimerErrors]
          | AuthNewSessionErrors[keyof AuthNewSessionErrors]
          | Error;
        response: HttpErrorResponse;
      }
  >(undefined);

  #timerService = inject(TimerService);
  #sessionService = inject(SessionService);
  #http = inject(HttpClient);

  onGetTimerById = async () => {
    let jwt;
    {
      const { data, error, response } = await this.#sessionService.authNewSession({
        httpClient: this.#http,
        body: {
          refresh_token: {},
        },
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
      const { data, error, response } = await this.#timerService.timekeeperPostTimer({
        httpClient: this.#http,
        body: {
          start_time: Date.now(),
          end_time: Date.now() + 3600,
          tags: [],
          time_split_timer: 1,
        },
        auth() {
          console.log(jwt?.access_token);
          return jwt?.access_token;
        },
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
    {
      const { data, error, response } = await this.#timerService.timekeeperGetTimers({
        httpClient: this.#http,
        auth: jwt?.access_token,
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
    }
    {
      const { data, error, response } = await this.#sessionService.authLogout({
        httpClient: this.#http,
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
  };
}

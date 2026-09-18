import {Component, signal} from '@angular/core';
import {ProgressSpinnerMode, MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSliderModule} from '@angular/material/slider';
import {MatIconModule} from '@angular/material/icon';
import {FormsModule} from '@angular/forms';
import {MatRadioModule} from '@angular/material/radio';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatToolbarModule} from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

/**
 * @title Configurable progress spinner
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [RouterOutlet, MatCardModule, MatRadioModule, FormsModule, MatSliderModule, MatProgressSpinnerModule, MatIconModule, MatButtonModule,MatToolbarModule],
})
export class App {
  protected readonly title = signal('Lockinspiel');
  mode = signal<ProgressSpinnerMode>('determinate');
  value = signal(50);
}

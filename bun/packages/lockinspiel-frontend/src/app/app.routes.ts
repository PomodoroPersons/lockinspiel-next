import { Routes } from '@angular/router';
import { MainPage } from './main-page/main-page';

export const routes: Routes = [
  {
    component: MainPage,
    path: '',
    pathMatch: 'full',
  },
];

import { Routes } from '@angular/router';
import { MainPage } from './main-page/main-page';
import { Login } from './login/login';

export const routes: Routes = [
  {
    component: Login,
    path: '',
    pathMatch: 'full',
  },
  {
    component: MainPage,
    path: 'home',
    pathMatch: 'full',
  },
];

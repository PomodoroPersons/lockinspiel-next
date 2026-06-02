import { Routes } from '@angular/router';
import { MainPage } from './main-page/main-page';
import { Login } from './login/login';
import { canActivate } from './services/auth/auth';
// import { AuthPage } from './auth-page/auth-page';

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
    canActivate: [canActivate],
  },
  // {
  //   component: AuthPage,
  //   path: 'login',
  //   pathMatch: 'full',
  // },
];

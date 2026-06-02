import { Routes } from '@angular/router';
import { MainPage } from './main-page/main-page';
import { UserProfile } from './user-profile/user-profile';
import { Setting } from './setting/setting';
import { AuthPage } from './auth-page/auth-page';

export const routes: Routes = [
  {
    component: MainPage,
    path: '',
    pathMatch: 'full',
  },
  {
    component: UserProfile,
    path: 'profile',
    pathMatch: 'full',
  },
  {
    component: Setting,
    path: 'settings',
    pathMatch: 'full',
  },
  {
    component: AuthPage,
    path: 'login',
    pathMatch: 'full',
  },
];

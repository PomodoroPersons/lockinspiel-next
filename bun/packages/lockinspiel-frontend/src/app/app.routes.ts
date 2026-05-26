import { Routes } from '@angular/router';
import { MainPage } from './main-page/main-page';
import { UserProfile } from './user-profile/user-profile';
import { Setting } from './setting/setting';

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
];

import { Routes } from '@angular/router';
import { Computers } from './features/computers/computers';
import { Login } from './features/login/login';
import { Peripherals } from './features/peripherals/peripherals';
import { System } from './features/system/system';

export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'computers' },
    { path: 'login', component: Login },
    { path: 'computers', component: Computers },
    { path: 'peripherals', component: Peripherals },
    { path: 'system', component: System },
    { path: '**', redirectTo: 'computers' },
];

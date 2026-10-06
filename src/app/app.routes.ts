import { Routes } from '@angular/router';
import { Computers } from './features/computers/computers';
import { Login } from './features/login/login';
import { Peripherals } from './features/peripherals/peripherals';
import { System } from './features/system/system';
import { PushMode } from './features/push-mode/push-mode';
import { PushInbox } from './features/push-inbox/push-inbox';

export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'computers' },
    { path: 'login', component: Login },
    { path: 'push-mode', component: PushMode },
    { path: 'push-inbox', component: PushInbox },
    { path: 'computers', component: Computers },
    { path: 'peripherals', component: Peripherals },
    { path: 'system', component: System },
    { path: '**', redirectTo: 'computers' },
];

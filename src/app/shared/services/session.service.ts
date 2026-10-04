import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ChictoolStateService } from './chictool-state.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
    constructor(
        private readonly state: ChictoolStateService,
        private readonly router: Router,
    ) {}

    async initialize(): Promise<void> {
        const api = this.state.bridge;
        if (!api) return;
        try {
            const [auth, lookups] = await Promise.all([api.authState(), api.lookups()]);
            this.state.hasUsers.set(auth.hasUsers);
            this.state.currentUser.set(auth.currentUser);
            this.state.lookups.set(lookups);
            if (auth.currentUser) {
                if (this.router.url === '/login') await this.router.navigateByUrl('/computers');
                await this.state.refreshDesktopData();
            } else {
                await this.router.navigateByUrl('/login');
            }
        } catch (error) {
            this.state.authError.set(error instanceof Error ? error.message : 'Could not open the local database.');
            await this.router.navigateByUrl('/login');
        }
    }

    async authenticate(action: 'login' | 'register', username: string, password: string): Promise<boolean> {
        const api = this.state.bridge;
        if (!api) return false;
        this.state.authError.set('');
        const auth = action === 'login' ? await api.login(username, password) : await api.register(username, password);
        this.state.hasUsers.set(auth.hasUsers);
        this.state.currentUser.set(auth.currentUser);
        if (auth.currentUser) await this.state.refreshDesktopData();
        return Boolean(auth.currentUser);
    }

    async signOut(): Promise<void> {
        try {
            const auth = await this.state.bridge?.logout();
            this.state.currentUser.set(auth?.currentUser ?? null);
            await this.router.navigateByUrl('/login');
        } catch (error) {
            this.state.authError.set(error instanceof Error ? error.message : 'Could not sign out.');
        }
    }
}

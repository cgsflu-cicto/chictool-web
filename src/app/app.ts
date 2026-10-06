import { Component, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Button } from '@openng/optimus-ui/button';
import type { Subscription } from 'rxjs';
import { ChictoolStateService } from './shared/services/chictool-state.service';
import { InventoryScanService } from './shared/services/inventory-scan.service';
import { SessionService } from './shared/services/session.service';

@Component({
    selector: 'app-root',
    imports: [Button, RouterOutlet],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App implements OnDestroy {
    private readonly state = inject(ChictoolStateService);
    readonly session = inject(SessionService);
    private readonly scanInput = inject(InventoryScanService);
    private readonly router = inject(Router);
    private readonly routeSubscription: Subscription;
    readonly desktop = this.state.desktop;
    readonly currentUser = this.state.currentUser;
    readonly authError = this.state.authError;
    readonly activeView = signal<'inventory' | 'peripherals' | 'database' | 'login' | 'push-mode' | 'push-inbox'>('inventory');
    private removePushListener?: () => void;

    constructor() {
        this.routeSubscription = this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) this.syncActiveView(event.urlAfterRedirects);
        });
        this.syncActiveView(this.router.url);
        void this.session.initialize();
        const bridge = this.state.bridge;
        if (bridge) {
            this.removePushListener = bridge.onPushReceived(() => void this.router.navigateByUrl('/push-inbox'));
            void bridge.getPushInbox().then((items) => {
                if (items.length) void this.router.navigateByUrl('/push-inbox');
            });
        }
        void this.scanInput;
    }

    ngOnDestroy(): void {
        this.routeSubscription.unsubscribe();
        this.removePushListener?.();
    }

    changeView(view: 'inventory' | 'peripherals' | 'database'): void {
        this.state.peripheralComputerFilter.set(null);
        const path = view === 'inventory' ? '/computers' : view === 'peripherals' ? '/peripherals' : '/system';
        void this.router.navigateByUrl(path);
    }

    openPushInbox(): void { void this.router.navigateByUrl('/push-inbox'); }

    dismissError(): void {
        this.authError.set('');
    }

    private syncActiveView(url: string): void {
        const segment = url.split(/[/?#]/)[1];
        const view =
            segment === 'login'
                ? 'login'
                : segment === 'push-mode'
                  ? 'push-mode'
                  : segment === 'push-inbox'
                    ? 'push-inbox'
                    : segment === 'peripherals'
                      ? 'peripherals'
                      : segment === 'system'
                        ? 'database'
                        : 'inventory';
        this.activeView.set(view);
    }
}

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
    readonly activeView = signal<'inventory' | 'peripherals' | 'database' | 'login'>('inventory');

    constructor() {
        this.routeSubscription = this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) this.syncActiveView(event.urlAfterRedirects);
        });
        this.syncActiveView(this.router.url);
        void this.session.initialize();
        void this.scanInput;
    }

    ngOnDestroy(): void {
        this.routeSubscription.unsubscribe();
    }

    changeView(view: 'inventory' | 'peripherals' | 'database'): void {
        this.state.peripheralComputerFilter.set(null);
        const path = view === 'inventory' ? '/computers' : view === 'peripherals' ? '/peripherals' : '/system';
        void this.router.navigateByUrl(path);
    }

    dismissError(): void {
        this.authError.set('');
    }

    private syncActiveView(url: string): void {
        const segment = url.split(/[/?#]/)[1];
        const view =
            segment === 'login'
                ? 'login'
                : segment === 'peripherals'
                  ? 'peripherals'
                  : segment === 'system'
                    ? 'database'
                    : 'inventory';
        this.activeView.set(view);
    }
}

import { Injectable, signal } from '@angular/core';
import type { Computer, Peripheral } from '../models';

@Injectable({ providedIn: 'root' })
export class ChictoolStateService {
    private readonly computersStorageKey = 'chictool-computers';
    readonly bridge = window.chictoolDesktop;
    readonly desktop = signal(Boolean(this.bridge));
    readonly hasUsers = signal(true);
    readonly currentUser = signal<{ id: number; username: string } | null>(null);
    readonly authError = signal('');
    readonly lookups = signal<Record<string, { value: string; label: string }[]>>({
        device_type: [],
        office: [],
        peripheral_type: [],
    });
    readonly computers = signal<Computer[]>([]);
    readonly peripherals = signal<Peripheral[]>([]);
    readonly peripheralComputerFilter = signal<string | null>(null);

    constructor() {
        try {
            const saved = localStorage.getItem(this.computersStorageKey);
            if (saved) this.computers.set(JSON.parse(saved) as Computer[]);
        } catch {
            try { localStorage.removeItem(this.computersStorageKey); } catch { /* Browser storage may be unavailable. */ }
        }
    }

    persistComputers(): void {
        try {
            localStorage.setItem(this.computersStorageKey, JSON.stringify(this.computers()));
        } catch {
            this.authError.set('Could not save computers in this browser.');
        }
    }

    async refreshDesktopData(): Promise<void> {
        const api = this.bridge;
        if (!api) return;
        const [computerRows, peripheralRows] = await Promise.all([api.listComputers(), api.listPeripherals()]);
        this.computers.set(computerRows);
        this.peripherals.set(
            peripheralRows.map((item) => ({
                ...item,
                computerSerialNumber:
                    computerRows.find((computer) => computer.id === item.computerId)?.serialNumber ?? '',
            })),
        );
    }

}

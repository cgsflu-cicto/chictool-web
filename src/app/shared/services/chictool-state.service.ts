import { Injectable, signal } from '@angular/core';
import type { Computer, Peripheral } from '../models';

const sampleComputers: Computer[] = [
    {
        id: '1',
        serialNumber: 'CT-2026-001',
        hostname: 'CICTO-LT-01',
        manufacturer: 'Dell',
        model: 'Latitude 5450',
        machineType: 'Laptop',
        office: 'CICTO',
        primaryUser: 'Ana Reyes',
        operatingSystem: 'Windows 11 Pro',
        collectedOn: '2026-09-24',
    },
    {
        id: '2',
        serialNumber: 'CT-2026-002',
        hostname: 'GSO-DSK-04',
        manufacturer: 'Lenovo',
        model: 'ThinkCentre M70',
        machineType: 'Desktop',
        office: 'GSO',
        primaryUser: 'Marco Santos',
        operatingSystem: 'Windows 11 Pro',
        collectedOn: '2026-09-23',
    },
];

@Injectable({ providedIn: 'root' })
export class ChictoolStateService {
    readonly bridge = window.chictoolDesktop;
    readonly desktop = signal(Boolean(this.bridge));
    readonly hasUsers = signal(true);
    readonly currentUser = signal<{ id: number; username: string } | null>(null);
    readonly authError = signal('');
    readonly lookups = signal<Record<string, { value: string; label: string }[]>>({
        device_type: ['Desktop', 'Laptop', 'All-in-One', 'Workstation', 'Server', 'Tablet', 'Thin Client', 'Other'].map(
            (value) => ({ value, label: value }),
        ),
        office: ['Main Office', 'Branch Office', 'Remote', 'Other', 'CICTO', 'GSO'].map((value) => ({
            value,
            label: value,
        })),
        peripheral_type: [
            'Monitor',
            'Printer',
            'UPS',
            'Keyboard',
            'Mouse',
            'Docking Station',
            'Webcam',
            'Headset',
            'Speakers',
            'Scanner',
            'Projector',
            'Other',
        ].map((value) => ({ value, label: value })),
    });
    readonly computers = signal<Computer[]>(this.read('chictool.computers', sampleComputers));
    readonly peripherals = signal<Peripheral[]>(this.read('chictool.peripherals', []));
    readonly peripheralComputerFilter = signal<string | null>(null);

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

    persistComputers(): void {
        localStorage.setItem('chictool.computers', JSON.stringify(this.computers()));
    }

    persistPeripherals(): void {
        localStorage.setItem('chictool.peripherals', JSON.stringify(this.peripherals()));
    }

    private read<T>(key: string, fallback: T[]): T[] {
        try {
            return JSON.parse(localStorage.getItem(key) ?? '') as T[];
        } catch {
            return fallback;
        }
    }
}

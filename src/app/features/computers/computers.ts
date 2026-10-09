import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { Button } from '@openng/optimus-ui/button';
import { CardModule } from '@openng/optimus-ui/card';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PasswordModule } from '@openng/optimus-ui/password';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import type { Computer, Peripheral } from '../../shared/models';
import { ChictoolStateService } from '../../shared/services/chictool-state.service';

const matchesSearch = (query: string, values: unknown[]): boolean =>
    !query ||
    values.some((value) =>
        String(value ?? '')
            .toLowerCase()
            .includes(query),
    );

@Component({
    selector: 'app-computers',
    imports: [
        CommonModule,
        FormsModule,
        AutoCompleteModule,
        Button,
        CardModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        PasswordModule,
        SelectModule,
        TextareaModule,
        TooltipModule,
    ],
    templateUrl: './computers.html',
    styleUrl: './computers.scss',
})
export class Computers {
    private readonly state = inject(ChictoolStateService);
    private readonly router = inject(Router);
    readonly computers = this.state.computers;
    readonly peripherals = this.state.peripherals;
    readonly lookups = this.state.lookups;
    readonly authError = this.state.authError;
    readonly desktop = this.state.desktop;
    readonly peripheralComputerFilter = this.state.peripheralComputerFilter;
    readonly query = signal('');
    readonly office = signal('');
    readonly showComputerForm = signal(false);
    readonly editingComputerId = signal<string | null>(null);
    readonly serialNumberReadOnly = signal(false);
    computerForm = this.blankComputer();
    captureMode: 'local' | 'remote' = 'local';
    readonly captureModes = [
        { label: 'This computer', value: 'local' },
        { label: 'Remote computer', value: 'remote' },
    ];
    captureHostname = '';
    captureUsername = '';
    capturePassword = '';
    readonly captureBusy = signal(false);
    readonly setupBusy = signal(false);
    readonly trustBusy = signal(false);
    readonly captureMessage = signal('');
    readonly captureResult = signal<Partial<Computer> | null>(null);
    readonly manufacturerSuggestions = signal<string[]>([]);
    readonly modelSuggestions = signal<string[]>([]);
    readonly userSuggestions = signal<string[]>([]);
    readonly offices = computed(() => [...new Set(this.computers().map((item) => item.office))].sort());
    readonly matchedCapturedComputer = computed(() => {
        const serialNumber = this.captureResult()?.serialNumber?.trim().toLowerCase();
        return serialNumber
            ? (this.computers().find((computer) => computer.serialNumber.trim().toLowerCase() === serialNumber) ?? null)
            : null;
    });
    readonly laptopCount = computed(() => this.computers().filter((item) => item.machineType === 'Laptop').length);
    readonly peripheralCounts = computed(() => {
        const counts = new Map<string, number>();
        for (const peripheral of this.peripherals()) {
            if (peripheral.computerId) counts.set(peripheral.computerId, (counts.get(peripheral.computerId) ?? 0) + 1);
        }
        return counts;
    });
    readonly filteredComputers = computed(() => {
        const query = this.query().trim().toLowerCase();
        return this.computers().filter(
            (item) =>
                (!this.office() || item.office === this.office()) &&
                matchesSearch(query, [
                    item.serialNumber,
                    item.serialOverride,
                    item.hostname,
                    item.manufacturer,
                    item.model,
                    item.primaryUser,
                    item.parHolder,
                    item.office,
                    item.operatingSystem,
                ]),
        );
    });

    public manageComputerPeripherals(): void {
        const computerId = this.editingComputerId();
        if (computerId) this.showPeripheralsForComputer(computerId);
    }

    public managePeripherals(computerId: string): void {
        this.showPeripheralsForComputer(computerId);
    }

    private showPeripheralsForComputer(computerId: string): void {
        this.peripheralComputerFilter.set(computerId);
        this.query.set('');
        this.office.set('');
        this.showComputerForm.set(false);
        void this.router.navigateByUrl('/peripherals');
    }

    public openComputerForm(computer?: Computer, preserveCaptured = false): void {
        this.editingComputerId.set(computer?.id ?? null);
        this.serialNumberReadOnly.set(!!computer);
        if (!preserveCaptured) this.computerForm = computer ? { ...computer } : this.blankComputer();
        this.captureMode = 'local';
        this.captureHostname = '';
        this.captureUsername = '';
        this.capturePassword = '';
        this.captureMessage.set('');
        this.showComputerForm.set(true);
    }

    public async captureComputer(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) {
            this.captureMessage.set('Hardware capture is available in the Electron desktop app.');
            return;
        }
        this.captureBusy.set(true);
        this.captureResult.set(null);
        this.captureMessage.set('Collecting hardware details…');
        try {
            const data = await api.captureComputer({
                mode: this.captureMode,
                hostname: this.captureHostname,
                username: this.captureUsername,
                password: this.capturePassword,
            });
            this.captureResult.set(data);
            const matched = this.computers().some(
                (computer) => computer.serialNumber.trim().toLowerCase() === data.serialNumber?.trim().toLowerCase(),
            );
            this.captureMessage.set(
                matched
                    ? `A saved record matches serial number ${data.serialNumber}. Choose which details to load.`
                    : `Captured details for ${data.hostname || 'the local computer'}. Choose Load captured details to review them.`,
            );
            this.capturePassword = '';
        } catch (error) {
            this.captureMessage.set(error instanceof Error ? error.message : 'Could not collect computer details.');
        } finally {
            this.captureBusy.set(false);
        }
    }

    public async downloadTargetSetup(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.setupBusy.set(true);
        try {
            this.captureMessage.set(await api.downloadTargetSetup());
        } catch (error) {
            this.captureMessage.set(error instanceof Error ? error.message : 'Could not save the target setup script.');
        } finally {
            this.setupBusy.set(false);
        }
    }

    public async trustTarget(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.trustBusy.set(true);
        this.captureMessage.set('Requesting administrator approval to trust the target…');
        try {
            this.captureMessage.set(await api.trustTarget(this.captureHostname));
        } catch (error) {
            this.captureMessage.set(error instanceof Error ? error.message : 'Could not trust the target.');
        } finally {
            this.trustBusy.set(false);
        }
    }

    public loadCapturedDetails(): void {
        const captured = this.captureResult();
        if (!captured) return;
        this.editingComputerId.set(null);
        this.serialNumberReadOnly.set(true);
        this.computerForm = { ...this.blankComputer(), ...captured };
        this.captureResult.set(null);
        this.captureMessage.set('');
        this.showComputerForm.set(true);
    }

    public loadSavedDetails(): void {
        const saved = this.matchedCapturedComputer();
        if (!saved) return;
        this.editingComputerId.set(saved.id);
        this.serialNumberReadOnly.set(true);
        this.computerForm = { ...saved };
        this.captureResult.set(null);
        this.captureMessage.set('');
        this.showComputerForm.set(true);
    }

    public trimModelEdges(): void {
        this.computerForm.model = this.computerForm.model.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }

    public suggestManufacturers(query: string): void {
        const records = [...this.computers(), ...this.peripherals()];
        this.manufacturerSuggestions.set(
            this.matchSuggestions(
                records.map((item) => item.manufacturer),
                query,
            ),
        );
    }

    public suggestModels(query: string): void {
        const manufacturer = this.computerForm.manufacturer.trim().toLocaleLowerCase();
        const records = [...this.computers(), ...this.peripherals()].filter(
            (item) => !manufacturer || item.manufacturer.trim().toLocaleLowerCase() === manufacturer,
        );
        this.modelSuggestions.set(
            this.matchSuggestions(
                records.map((item) => item.model),
                query,
            ),
        );
    }

    public suggestUsers(query: string): void {
        const computerUsers = this.computers().flatMap((computer) => [computer.primaryUser, computer.parHolder ?? '']);
        const peripheralUsers = this.peripherals().map((peripheral) => peripheral.assignedUser);
        this.userSuggestions.set(this.matchSuggestions([...computerUsers, ...peripheralUsers], query));
    }

    private matchSuggestions(values: string[], query: string): string[] {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return [
            ...new Set(
                values
                    .map((value) => value.trim())
                    .filter((value) => value && value.toLocaleLowerCase().includes(normalizedQuery)),
            ),
        ]
            .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
            .slice(0, 8);
    }

    public async saveComputer(): Promise<void> {
        if (!this.computerForm.serialNumber.trim() || !this.computerForm.office.trim()) return;
        const record = {
            ...this.computerForm,
            serialNumber: this.computerForm.serialNumber.trim(),
            collectedOn: new Date().toISOString(),
            acquiredOn: this.computerForm.acquiredOn?.trim() ?? '',
        };
        if (window.chictoolDesktop) {
            try {
                const saved = await window.chictoolDesktop.saveComputer(record);
                this.computers.update((items) =>
                    this.editingComputerId()
                        ? items.map((item) => (item.id === record.id ? saved : item))
                        : [saved, ...items],
                );
                this.showComputerForm.set(false);
            } catch (error) {
                this.authError.set(error instanceof Error ? error.message : 'Could not save the computer.');
            }
            return;
        }
        this.computers.update((items) =>
            this.editingComputerId()
                ? items.map((item) => (item.id === record.id ? record : item))
                : [record, ...items],
        );
        this.state.persistComputers();
        this.showComputerForm.set(false);
    }

    public async deleteComputer(computer: Computer): Promise<void> {
        if (!confirm(`Remove ${computer.serialNumber} from inventory?`)) return;
        if (window.chictoolDesktop) {
            try {
                await window.chictoolDesktop.deleteComputer(computer.id);
                await this.state.refreshDesktopData();
            } catch (error) {
                this.authError.set(error instanceof Error ? error.message : 'Could not delete the computer.');
            }
            return;
        }
        this.computers.update((items) => items.filter((item) => item.id !== computer.id));
        this.peripherals.update((items) =>
            items.map((item) =>
                item.computerSerialNumber === computer.serialNumber ? { ...item, computerSerialNumber: '' } : item,
            ),
        );
    }

    private blankComputer(): Computer {
        return {
            id: crypto.randomUUID(),
            serialNumber: '',
            parHolder: '',
            hostname: '',
            manufacturer: '',
            model: '',
            machineType: '',
            office: '',
            primaryUser: '',
            operatingSystem: '',
            collectedOn: new Date().toISOString().slice(0, 10),
        };
    }
}

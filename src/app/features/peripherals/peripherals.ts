import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import type { Peripheral } from '../../shared/models';
import { ChictoolStateService } from '../../shared/services/chictool-state.service';

const matchesSearch = (query: string, values: unknown[]): boolean =>
    !query ||
    values.some((value) =>
        String(value ?? '')
            .toLowerCase()
            .includes(query),
    );

@Component({
    selector: 'app-peripherals',
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
    templateUrl: './peripherals.html',
    styleUrl: './peripherals.scss',
})
export class Peripherals {
    private readonly state = inject(ChictoolStateService);
    readonly computers = this.state.computers;
    readonly peripherals = this.state.peripherals;
    readonly lookups = this.state.lookups;
    readonly authError = this.state.authError;
    readonly query = signal('');
    readonly showPeripheralForm = signal(false);
    readonly editingPeripheralId = signal<string | null>(null);
    readonly peripheralComputerFilter = this.state.peripheralComputerFilter;
    peripheralForm = this.blankPeripheral();
    readonly manufacturerSuggestions = signal<string[]>([]);
    readonly modelSuggestions = signal<string[]>([]);
    readonly userSuggestions = signal<string[]>([]);
    readonly peripheralFilterComputer = computed(() => {
        const id = this.peripheralComputerFilter();
        return id ? (this.computers().find((computer) => computer.id === id) ?? null) : null;
    });
    readonly assignedCount = computed(() => this.peripherals().filter((item) => item.computerSerialNumber).length);
    readonly filteredPeripherals = computed(() => {
        const query = this.query().trim().toLowerCase();
        return this.peripherals().filter(
            (item) =>
                (!this.peripheralComputerFilter() || item.computerId === this.peripheralComputerFilter()) &&
                matchesSearch(query, [
                    item.type,
                    item.serialNumber,
                    item.manufacturer,
                    item.model,
                    item.assignedUser,
                    item.computerSerialNumber,
                ]),
        );
    });

    public clearPeripheralComputerFilter(): void {
        this.peripheralComputerFilter.set(null);
    }

    public openPeripheralForm(peripheral?: Peripheral): void {
        this.editingPeripheralId.set(peripheral?.id ?? null);
        if (peripheral) {
            this.peripheralForm = { ...peripheral };
        } else {
            const selectedComputer = this.peripheralFilterComputer();
            this.peripheralForm = {
                ...this.blankPeripheral(),
                computerId: selectedComputer?.id ?? '',
                computerSerialNumber: selectedComputer?.serialNumber ?? '',
            };
        }
        this.showPeripheralForm.set(true);
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
        const manufacturer = this.peripheralForm.manufacturer.trim().toLocaleLowerCase();
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

    public async savePeripheral(): Promise<void> {
        if (!this.peripheralForm.type.trim()) return;
        const record = { ...this.peripheralForm, syncId: this.peripheralForm.syncId.trim() || crypto.randomUUID() };
        if (window.chictoolDesktop) {
            try {
                const saved = await window.chictoolDesktop.savePeripheral(record);
                const computerSerialNumber =
                    this.computers().find((computer) => computer.id === saved.computerId)?.serialNumber ?? '';
                const savedWithComputer = { ...saved, computerSerialNumber };
                this.peripherals.update((items) =>
                    this.editingPeripheralId()
                        ? items.map((item) => (item.id === record.id ? savedWithComputer : item))
                        : [savedWithComputer, ...items],
                );
                this.showPeripheralForm.set(false);
            } catch (error) {
                this.authError.set(error instanceof Error ? error.message : 'Could not save the peripheral.');
            }
            return;
        }
        this.peripherals.update((items) =>
            this.editingPeripheralId()
                ? items.map((item) => (item.id === record.id ? record : item))
                : [record, ...items],
        );
        this.state.persistPeripherals();
        this.showPeripheralForm.set(false);
    }

    public async deletePeripheral(peripheral: Peripheral): Promise<void> {
        if (confirm(`Remove this ${peripheral.type}?`)) {
            if (window.chictoolDesktop) {
                try {
                    await window.chictoolDesktop.deletePeripheral(peripheral.id);
                    this.peripherals.update((items) => items.filter((item) => item.id !== peripheral.id));
                } catch (error) {
                    this.authError.set(error instanceof Error ? error.message : 'Could not delete the peripheral.');
                }
                return;
            }
            this.peripherals.update((items) => items.filter((item) => item.id !== peripheral.id));
            this.state.persistPeripherals();
        }
    }

    private blankPeripheral(): Peripheral {
        return {
            id: crypto.randomUUID(),
            syncId: '',
            type: 'Monitor',
            manufacturer: '',
            model: '',
            serialNumber: '',
            assignedUser: '',
            computerSerialNumber: '',
            computerId: '',
        };
    }
}

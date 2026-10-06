import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { Button } from '@openng/optimus-ui/button';
import { CardModule } from '@openng/optimus-ui/card';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import type { Computer, PushSubmission } from '../../shared/models';
import { ChictoolStateService } from '../../shared/services/chictool-state.service';

@Component({
    selector: 'app-push-inbox',
    imports: [
        CommonModule,
        FormsModule,
        AutoCompleteModule,
        Button,
        CardModule,
        InputTextModule,
        SelectModule,
        TextareaModule,
        TooltipModule,
    ],
    templateUrl: './push-inbox.html',
    styleUrl: '../computers/computers.scss',
})
export class PushInbox implements OnDestroy {
    private readonly state = inject(ChictoolStateService);
    private readonly router = inject(Router);
    readonly currentUser = this.state.currentUser;
    readonly lookups = this.state.lookups;
    readonly items = signal<PushSubmission[]>([]);
    readonly error = signal('');
    readonly activeSubmission = signal<PushSubmission | null>(null);
    readonly manufacturerSuggestions = signal<string[]>([]);
    readonly modelSuggestions = signal<string[]>([]);
    readonly userSuggestions = signal<string[]>([]);
    computerForm = this.blankComputer();
    private removeListener?: () => void;

    constructor() {
        void this.load();
        this.removeListener = window.chictoolDesktop?.onPushReceived(() => void this.load());
    }

    ngOnDestroy(): void {
        this.removeListener?.();
    }

    async load(): Promise<void> {
        this.items.set((await this.state.bridge?.getPushInbox()) ?? []);
    }

    review(item: PushSubmission): void {
        this.error.set('');
        this.computerForm = this.toComputer(item);
        this.activeSubmission.set(item);
    }

    closeReview(): void {
        this.activeSubmission.set(null);
    }

    suggestManufacturers(query: string): void {
        this.manufacturerSuggestions.set(
            this.suggestions(
                query,
                this.items().map((item) => item.computer.manufacturer || ''),
            ),
        );
    }
    suggestModels(query: string): void {
        this.modelSuggestions.set(
            this.suggestions(
                query,
                this.items().map((item) => item.computer.model || ''),
            ),
        );
    }
    suggestUsers(query: string): void {
        this.userSuggestions.set(
            this.suggestions(
                query,
                this.items().flatMap((item) => [item.computer.primaryUser || '', item.computer.username || '']),
            ),
        );
    }

    trimModelEdges(): void {
        this.computerForm.model = this.computerForm.model.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }

    async decide(action: 'save' | 'discard'): Promise<void> {
        const item = this.activeSubmission();
        if (!item) return;
        this.error.set('');
        if (action === 'save' && !this.currentUser()) {
            await this.router.navigate(['/login'], { queryParams: { returnUrl: '/push-inbox' } });
            return;
        }
        try {
            const computer =
                action === 'save'
                    ? { ...this.computerForm, serialNumber: this.computerForm.serialNumber.trim() }
                    : undefined;
            await this.state.bridge?.decidePush(item.id, action, computer);
            this.items.update((items) => items.filter((submission) => submission.id !== item.id));
            this.activeSubmission.set(null);
            if (action === 'save') await this.state.refreshDesktopData();
        } catch (error) {
            this.error.set(error instanceof Error ? error.message : 'Could not complete this review.');
        }
    }

    signIn(): void {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/push-inbox' } });
    }

    private suggestions(query: string, values: string[]): string[] {
        const normalized = query.trim().toLocaleLowerCase();
        return [
            ...new Set(
                values
                    .map((value) => value.trim())
                    .filter((value) => value && value.toLocaleLowerCase().includes(normalized)),
            ),
        ]
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 8);
    }

    private toComputer(item: PushSubmission): Computer {
        const source = item.computer;
        return {
            ...this.blankComputer(),
            ...source,
            id: crypto.randomUUID(),
            serialNumber: source.serialNumber || '',
            machineType: source.machineType || 'Other',
            office: source.office || '',
            collectedOn: source.collectedOn || new Date().toISOString().slice(0, 10),
        };
    }

    private blankComputer(): Computer {
        return {
            id: crypto.randomUUID(),
            serialNumber: '',
            hostname: '',
            manufacturer: '',
            model: '',
            machineType: 'Laptop',
            office: '',
            primaryUser: '',
            operatingSystem: '',
            collectedOn: new Date().toISOString().slice(0, 10),
            serialOverride: '',
            processor: '',
            storage: '',
            memory: '',
            gpu: '',
            macAddress: '',
            details: '',
            username: '',
            acquiredOn: '',
            parHolder: '',
            remarks: '',
            scriptVersion: '',
        };
    }
}

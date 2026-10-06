import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { ChictoolStateService } from '../../shared/services/chictool-state.service';

@Component({
    selector: 'app-push-mode',
    imports: [FormsModule, Button, InputTextModule],
    templateUrl: './push-mode.html',
    styleUrl: './push-mode.scss',
})
export class PushMode {
    readonly router = inject(Router);
    private readonly state = inject(ChictoolStateService);
    serverUrl = '';
    serverDraft = '';
    readonly configured = signal(false);
    readonly editingReceiver = signal(true);
    readonly busy = signal(false);
    readonly message = signal('');
    readonly error = signal('');
    readonly setupError = signal('');

    constructor() {
        void window.chictoolDesktop?.getPushConfig().then((config) => {
            this.serverUrl = config.serverUrl;
            this.configured.set(Boolean(config.serverUrl));
            this.serverDraft = config.serverUrl;
            this.editingReceiver.set(!config.serverUrl);
        });
    }

    async toggleReceiver(): Promise<void> {
        if (!this.editingReceiver()) {
            this.serverDraft = this.serverUrl;
            this.setupError.set('');
            this.editingReceiver.set(true);
            return;
        }
        await this.saveReceiver();
    }

    async saveReceiver(): Promise<void> {
        const api = this.state.bridge;
        if (!api) return;
        this.busy.set(true);
        this.setupError.set('');
        try {
            const config = await api.setPushServer(this.serverDraft.trim());
            this.serverUrl = config.serverUrl;
            this.serverDraft = config.serverUrl;
            this.configured.set(true);
            this.editingReceiver.set(false);
            this.message.set('Receiver tested and saved.');
        } catch (error) {
            this.setupError.set(error instanceof Error ? error.message : 'Could not test receiver.');
        } finally {
            this.busy.set(false);
        }
    }

    async captureAndSend(): Promise<void> {
        const api = this.state.bridge;
        if (!api) return;
        this.busy.set(true);
        this.error.set('');
        this.message.set('Capturing this computer…');
        try {
            const result = await api.pushLocalCapture();
            this.message.set(result.message);
        } catch (error) {
            this.message.set('');
            this.error.set(error instanceof Error ? error.message : 'Could not send computer details.');
        } finally {
            this.busy.set(false);
        }
    }
}

import { Injectable, OnDestroy } from '@angular/core';
import type { IncomingScan } from '../models';
import { ChictoolStateService } from './chictool-state.service';

@Injectable({ providedIn: 'root' })
export class InventoryScanService implements OnDestroy {
    private readonly stopListener?: () => void;

    constructor(state: ChictoolStateService) {
        this.stopListener = state.bridge?.onScanReceived((scan) => this.fillFocusedField(scan));
    }

    ngOnDestroy(): void {
        this.stopListener?.();
    }

    private fillFocusedField(scan: IncomingScan): void {
        const activeElement = document.activeElement;
        let message = '';
        if (activeElement instanceof HTMLInputElement) {
            const supportedTypes = ['text', 'search', 'email', 'tel', 'url'];
            if (activeElement.disabled || activeElement.readOnly || !supportedTypes.includes(activeElement.type)) {
                message = 'The focused input is not an editable text field.';
            } else {
                activeElement.value = scan.value;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else if (activeElement instanceof HTMLTextAreaElement) {
            if (activeElement.disabled || activeElement.readOnly) {
                message = 'The focused text area is not editable.';
            } else {
                activeElement.value = scan.value;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            message = 'Focus an editable text input or text area before scanning.';
        }
        void window.chictoolDesktop?.completeScan(scan.requestId, { ok: !message, message }).catch(() => undefined);
    }
}

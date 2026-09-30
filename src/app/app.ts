import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { Button } from '@openng/optimus-ui/button';
import { CardModule } from '@openng/optimus-ui/card';
import { BarsIcon } from '@openng/optimus-ui/icons/bars';
import { FilterIcon } from '@openng/optimus-ui/icons/filter';
import { PlusIcon } from '@openng/optimus-ui/icons/plus';
import { ThLargeIcon } from '@openng/optimus-ui/icons/thlarge';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { SearchIcon } from '@openng/optimus-ui/icons/search';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PasswordModule } from '@openng/optimus-ui/password';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { toDataURL } from 'qrcode';

type DeviceType = 'Desktop' | 'Laptop' | 'All-in-One' | 'Server' | 'Tablet' | 'Phone' | 'Other';
interface Computer {
    id: string;
    serialNumber: string;
    hostname: string;
    manufacturer: string;
    model: string;
    machineType: DeviceType;
    office: string;
    primaryUser: string;
    operatingSystem: string;
    collectedOn: string;
    serialOverride?: string;
    processor?: string;
    storage?: string;
    memory?: string;
    gpu?: string;
    macAddress?: string;
    details?: string;
    username?: string;
    acquiredOn?: string;
    parHolder?: string;
    remarks?: string;
    scriptVersion?: string;
}
interface Peripheral {
    id: string;
    syncId: string;
    type: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    assignedUser: string;
    computerSerialNumber: string;
    computerId: string;
}
interface AuthState {
    hasUsers: boolean;
    currentUser: { id: number; username: string } | null;
}
interface DatabaseSyncResult {
    lookups: { downloaded: number };
    computers: { synced: number; total: number };
    peripherals: { synced: number; total: number };
    synced: number;
    failed: number;
    failures: string[];
}
interface ScanEndpointInfo {
    enabled: boolean;
    port: number;
    urls: string[];
    error: string;
}
interface IncomingScan {
    requestId: string;
    value: string;
}
interface HotspotSettings {
    networkName: string;
    password: string;
}
interface HotspotStatus { state: string; clientCount: number | null; networkName: string; }
interface DesktopBridge {
    authState(): Promise<AuthState>;
    login(username: string, password: string): Promise<AuthState>;
    register(username: string, password: string): Promise<AuthState>;
    logout(): Promise<AuthState>;
    lookups(): Promise<Record<string, { value: string; label: string }[]>>;
    listComputers(): Promise<Computer[]>;
    saveComputer(computer: Computer): Promise<Computer>;
    deleteComputer(id: string): Promise<void>;
    captureComputer(request: { mode: 'local' | 'remote'; hostname?: string; username?: string; password?: string }): Promise<Partial<Computer>>;
    downloadTargetSetup(): Promise<string>;
    trustTarget(hostname: string): Promise<string>;
    getSyncSettings(): Promise<{ serverUrl: string }>;
    setSyncServer(serverUrl: string): Promise<{ serverUrl: string }>;
    syncDatabase(): Promise<DatabaseSyncResult>;
    resetDatabase(): Promise<{ computers: number; peripherals: number; collectionLogs: number; auditLogs: number }>;
    getHotspotSettings(): Promise<HotspotSettings>;
    setHotspotName(networkName: string, password: string): Promise<HotspotSettings>;
    openWindowsHotspotSettings(): Promise<void>;
    getHotspotStatus(): Promise<HotspotStatus>;
    startHotspot(networkName: string, password: string): Promise<HotspotStatus>;
    stopHotspot(): Promise<HotspotStatus>;
    getScanEndpointInfo(): Promise<ScanEndpointInfo>;
    onScanReceived(listener: (scan: IncomingScan) => void): () => void;
    completeScan(requestId: string, result: { ok: boolean; message?: string }): Promise<boolean>;
    listPeripherals(): Promise<Peripheral[]>;
    savePeripheral(peripheral: Peripheral): Promise<Peripheral>;
    deletePeripheral(id: string): Promise<void>;
}

declare global {
    interface Window {
        chictoolDesktop?: DesktopBridge;
    }
}

const computers: Computer[] = [
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

@Component({
    selector: 'app-root',
    imports: [CommonModule, FormsModule, AutoCompleteModule, Button, CardModule, BarsIcon, FilterIcon, PlusIcon, ThLargeIcon, IconFieldModule, InputIconModule, SearchIcon, InputTextModule, PasswordModule, SelectModule, TextareaModule, TooltipModule],
    styleUrl: './app.scss',
    templateUrl: './app.html',
})
export class App implements OnDestroy {
    protected readonly desktop = signal(Boolean(window.chictoolDesktop));
    protected readonly hasUsers = signal(true);
    protected readonly currentUser = signal<AuthState['currentUser']>(null);
    protected readonly authError = signal('');
    protected readonly authForm = { username: '', password: '' };
    protected readonly lookups = signal<Record<string, { value: string; label: string }[]>>({
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
    protected readonly activeView = signal<'inventory' | 'peripherals' | 'database'>('inventory');
    protected readonly query = signal('');
    protected readonly office = signal('');
    protected readonly peripheralComputerFilter = signal<string | null>(null);
    protected readonly showComputerForm = signal(false);
    protected readonly showPeripheralForm = signal(false);
    protected readonly editingComputerId = signal<string | null>(null);
    protected readonly editingPeripheralId = signal<string | null>(null);
    protected readonly computers = signal<Computer[]>(this.read('chictool.computers', computers));
    protected readonly peripherals = signal<Peripheral[]>(this.read('chictool.peripherals', []));
    protected computerForm = this.blankComputer();
    protected captureMode: 'local' | 'remote' = 'local';
    protected readonly captureModes = [
        { label: 'This computer', value: 'local' },
        { label: 'Remote computer', value: 'remote' },
    ];
    protected captureHostname = '';
    protected captureUsername = '';
    protected capturePassword = '';
    protected readonly captureBusy = signal(false);
    protected readonly setupBusy = signal(false);
    protected readonly trustBusy = signal(false);
    protected readonly captureMessage = signal('');
    protected readonly captureResult = signal<Partial<Computer> | null>(null);
    protected readonly databaseServerUrl = signal('');
    protected readonly databaseBusy = signal(false);
    protected readonly databaseMessage = signal('');
    protected readonly databaseMessageIsError = signal(false);
    protected readonly scanEndpoint = signal<ScanEndpointInfo>({ enabled: false, port: 47831, urls: [], error: '' });
    protected readonly hotspotNetworkName = signal('CHICTool');
    protected hotspotPassword = '';
    protected readonly hotspotQrCode = signal('');
    protected readonly hotspotMessage = signal('');
    protected readonly hotspotMessageIsError = signal(false);
    protected readonly hotspotBusy = signal(false);
    protected readonly hotspotStatus = signal<HotspotStatus | null>(null);
    protected peripheralForm = this.blankPeripheral();
    protected readonly manufacturerSuggestions = signal<string[]>([]);
    protected readonly modelSuggestions = signal<string[]>([]);
    protected readonly userSuggestions = signal<string[]>([]);
    protected readonly offices = computed(() => [...new Set(this.computers().map((item) => item.office))].sort());
    protected readonly matchedCapturedComputer = computed(() => {
        const serialNumber = this.captureResult()?.serialNumber?.trim().toLowerCase();
        return serialNumber
            ? (this.computers().find((computer) => computer.serialNumber.trim().toLowerCase() === serialNumber) ?? null)
            : null;
    });
    protected readonly peripheralFilterComputer = computed(() => {
        const id = this.peripheralComputerFilter();
        return id ? (this.computers().find((computer) => computer.id === id) ?? null) : null;
    });
    protected readonly laptopCount = computed(
        () => this.computers().filter((item) => item.machineType === 'Laptop').length,
    );
    protected readonly assignedCount = computed(
        () => this.peripherals().filter((item) => item.computerSerialNumber).length,
    );
    protected readonly peripheralCounts = computed(() => {
        const counts = new Map<string, number>();
        for (const peripheral of this.peripherals()) {
            if (peripheral.computerId) {
                counts.set(peripheral.computerId, (counts.get(peripheral.computerId) ?? 0) + 1);
            }
        }
        return counts;
    });
    protected readonly filteredComputers = computed(() => {
        const query = this.query().trim().toLowerCase();
        return this.computers().filter(
            (item) =>
                (!this.office() || item.office === this.office()) &&
                (!query ||
                    [item.serialNumber, item.hostname, item.manufacturer, item.model, item.primaryUser].some((value) =>
                        value.toLowerCase().includes(query),
                    )),
        );
    });
    protected readonly filteredPeripherals = computed(() => {
        const query = this.query().trim().toLowerCase();
        return this.peripherals().filter(
            (item) =>
                (!this.peripheralComputerFilter() || item.computerId === this.peripheralComputerFilter()) &&
                (!query ||
                    [item.type, item.serialNumber, item.manufacturer, item.model, item.assignedUser].some((value) =>
                        value.toLowerCase().includes(query),
                    )),
        );
    });
    private stopScanListener?: () => void;

    constructor() {
        if (window.chictoolDesktop) {
            this.stopScanListener = window.chictoolDesktop.onScanReceived((scan) => this.fillFocusedField(scan));
            void this.initializeDesktop();
        }
    }

    ngOnDestroy(): void {
        this.stopScanListener?.();
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

    protected async signIn(): Promise<void> {
        await this.authenticate('login');
    }

    protected async createAccount(): Promise<void> {
        await this.authenticate('register');
    }

    protected async signOut(): Promise<void> {
        const state = await window.chictoolDesktop?.logout();
        this.currentUser.set(state?.currentUser ?? null);
    }

    private async authenticate(action: 'login' | 'register'): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.authError.set('');
        try {
            const state =
                action === 'login'
                    ? await api.login(this.authForm.username, this.authForm.password)
                    : await api.register(this.authForm.username, this.authForm.password);
            this.hasUsers.set(state.hasUsers);
            this.currentUser.set(state.currentUser);
            if (state.currentUser) await this.refreshDesktopData();
        } catch (error) {
            this.authError.set(error instanceof Error ? error.message : 'Could not authenticate.');
        }
    }

    private async initializeDesktop(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        try {
            const [state, lookups, syncSettings, scanEndpoint, hotspotSettings] = await Promise.all([
                api.authState(),
                api.lookups(),
                api.getSyncSettings(),
                api.getScanEndpointInfo(),
                api.getHotspotSettings(),
            ]);
            this.hasUsers.set(state.hasUsers);
            this.currentUser.set(state.currentUser);
            this.lookups.set(lookups);
            this.databaseServerUrl.set(syncSettings.serverUrl);
            this.scanEndpoint.set(scanEndpoint);
            this.hotspotNetworkName.set(hotspotSettings.networkName);
            this.hotspotPassword = hotspotSettings.password;
            try {
                const status = await api.getHotspotStatus();
                this.hotspotStatus.set(status);
                if (status.state === 'On') {
                    this.hotspotMessage.set(`Hotspot is running as ${hotspotSettings.networkName}.`);
                    this.hotspotMessageIsError.set(false);
                }
            } catch (error) {
                this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not read Mobile Hotspot status.');
                this.hotspotMessageIsError.set(true);
            }
            if (state.currentUser) await this.refreshDesktopData();
        } catch (error) {
            this.authError.set(error instanceof Error ? error.message : 'Could not open the local database.');
        }
    }

    private async refreshDesktopData(): Promise<void> {
        const api = window.chictoolDesktop;
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
    private async refreshScanEndpoint(): Promise<void> {
        const api = window.chictoolDesktop;
        if (api) this.scanEndpoint.set(await api.getScanEndpointInfo());
    }
    private async refreshHotspotAndScanEndpoint(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        try {
            const status = await api.getHotspotStatus();
            this.hotspotStatus.set(status);
            if (status.state !== 'On') this.hotspotQrCode.set('');
        } catch {
            // Still refresh the endpoint list if Windows cannot report hotspot status.
        }
        try {
            await this.refreshScanEndpoint();
        } catch {
            // Keep the last available endpoints if discovery temporarily fails.
        }
    }

    protected changeView(view: 'inventory' | 'peripherals' | 'database'): void {
        this.activeView.set(view);
        this.query.set('');
        this.office.set('');
        this.peripheralComputerFilter.set(null);
    }
    protected manageComputerPeripherals(): void {
        const computerId = this.editingComputerId();
        if (!computerId) return;
        this.showPeripheralsForComputer(computerId);
    }
    protected managePeripherals(computerId: string): void {
        this.showPeripheralsForComputer(computerId);
    }
    private showPeripheralsForComputer(computerId: string): void {
        this.peripheralComputerFilter.set(computerId);
        this.query.set('');
        this.office.set('');
        this.activeView.set('peripherals');
        this.showComputerForm.set(false);
    }
    protected clearPeripheralComputerFilter(): void {
        this.peripheralComputerFilter.set(null);
    }
    protected async saveDatabaseServer(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.databaseBusy.set(true);
        this.databaseMessage.set('');
        try {
            const settings = await api.setSyncServer(this.databaseServerUrl());
            this.databaseServerUrl.set(settings.serverUrl);
            this.databaseMessage.set(settings.serverUrl ? 'Target server saved.' : 'Target server cleared.');
            this.databaseMessageIsError.set(false);
        } catch (error) {
            this.databaseMessage.set(error instanceof Error ? error.message : 'Could not save target server.');
            this.databaseMessageIsError.set(true);
        } finally {
            this.databaseBusy.set(false);
        }
    }
    protected async syncDatabase(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.databaseBusy.set(true);
        this.databaseMessage.set('Syncing computers and peripherals…');
        this.databaseMessageIsError.set(false);
        try {
            const result = await api.syncDatabase();
            const lookupSummary = result.lookups
                ? `Downloaded ${result.lookups.downloaded} lookup values; `
                : '';
            const summary = `${lookupSummary}Synced ${result.computers.synced}/${result.computers.total} computers and ${result.peripherals.synced}/${result.peripherals.total} peripherals.`;
            const failure = result.failures[0];
            this.databaseMessage.set(result.failed ? `${summary} ${result.failed} failed.${failure ? ` ${failure}` : ''}` : summary);
            this.databaseMessageIsError.set(result.failed > 0);
        } catch (error) {
            this.databaseMessage.set(error instanceof Error ? error.message : 'Could not sync with the target server.');
            this.databaseMessageIsError.set(true);
        } finally {
            this.databaseBusy.set(false);
        }
    }
    protected async resetSqliteDatabase(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api || !window.confirm('Permanently remove all computer, peripheral, collection log, and audit log records from this SQLite database? User accounts and lookup values will remain.')) return;
        this.databaseBusy.set(true);
        this.databaseMessage.set('Resetting the local SQLite database…');
        this.databaseMessageIsError.set(false);
        try {
            const counts = await api.resetDatabase();
            await this.refreshDesktopData();
            this.databaseMessage.set(`SQLite database reset. Removed ${counts.computers} computers, ${counts.peripherals} peripherals, ${counts.collectionLogs} collection logs, and ${counts.auditLogs} audit entries. User accounts and lookup values were kept.`);
        } catch (error) {
            this.databaseMessage.set(error instanceof Error ? error.message : 'Could not reset the SQLite database.');
            this.databaseMessageIsError.set(true);
        } finally {
            this.databaseBusy.set(false);
        }
    }
    protected async showHotspotQrCode(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        const networkName = this.hotspotNetworkName().trim();
        if (!networkName) {
            this.hotspotMessage.set('Enter the hotspot name first.');
            this.hotspotMessageIsError.set(true);
            return;
        }
        if (this.hotspotPassword.length < 8) {
            this.hotspotMessage.set('Enter the hotspot password (at least 8 characters).');
            this.hotspotMessageIsError.set(true);
            return;
        }
        const escapeWifiValue = (value: string) => value.replace(/([\\;,:\"])/g, '\\$1');
        this.hotspotBusy.set(true);
        this.hotspotMessage.set('');
        try {
            const settings = await api.setHotspotName(networkName, this.hotspotPassword);
            this.hotspotNetworkName.set(settings.networkName);
            this.hotspotPassword = settings.password;
            this.hotspotQrCode.set(
                await toDataURL(`WIFI:T:WPA;S:${escapeWifiValue(settings.networkName)};P:${escapeWifiValue(this.hotspotPassword)};;`, {
                    errorCorrectionLevel: 'M',
                    margin: 1,
                    width: 280,
                }),
            );
            this.hotspotMessage.set('Scan the QR code with a phone camera to join the hotspot. The password is not saved.');
            this.hotspotMessageIsError.set(false);
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not create the hotspot QR code.');
            this.hotspotMessageIsError.set(true);
        } finally {
            this.hotspotBusy.set(false);
        }
    }
    protected async startHotspot(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.hotspotBusy.set(true);
        try {
            const settings = await api.setHotspotName(this.hotspotNetworkName(), this.hotspotPassword);
            this.hotspotNetworkName.set(settings.networkName);
            this.hotspotPassword = settings.password;
            const status = await api.startHotspot(settings.networkName, settings.password);
            this.hotspotStatus.set(status);
            await this.showHotspotQrCode();
            const connectionCount = Number.isInteger(status.clientCount)
                ? ` ${status.clientCount} device${status.clientCount === 1 ? '' : 's'} connected.`
                : '';
            this.hotspotMessage.set(`Hotspot started.${connectionCount}`);
            this.hotspotMessageIsError.set(false);
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not start Mobile Hotspot.');
            this.hotspotMessageIsError.set(true);
        } finally {
            await this.refreshHotspotAndScanEndpoint();
            this.hotspotBusy.set(false);
        }
    }
    protected async toggleHotspot(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        try {
            const status = this.hotspotStatus() ?? await api.getHotspotStatus();
            this.hotspotStatus.set(status);
            if (status.state === 'On') await this.stopHotspot();
            else await this.startHotspot();
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not read Mobile Hotspot status.');
            this.hotspotMessageIsError.set(true);
        }
    }
    protected closeHotspotQrCode(): void {
        this.hotspotQrCode.set('');
    }
    protected async stopHotspot(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.hotspotBusy.set(true);
        try {
            this.hotspotStatus.set(await api.stopHotspot());
            this.hotspotQrCode.set('');
            this.hotspotMessage.set('Hotspot stopped.');
            this.hotspotMessageIsError.set(false);
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not stop Mobile Hotspot.');
            this.hotspotMessageIsError.set(true);
        } finally {
            await this.refreshHotspotAndScanEndpoint();
            this.hotspotBusy.set(false);
        }
    }
    protected async openWindowsHotspotSettings(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.hotspotBusy.set(true);
        this.hotspotMessage.set('');
        try {
            await api.openWindowsHotspotSettings();
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not open Windows Mobile Hotspot settings.');
            this.hotspotMessageIsError.set(true);
        } finally {
            this.hotspotBusy.set(false);
        }
    }
    protected openComputerForm(computer?: Computer, preserveCaptured = false): void {
        this.editingComputerId.set(computer?.id ?? null);
        if (!preserveCaptured) this.computerForm = computer ? { ...computer } : this.blankComputer();
        this.captureMode = 'local';
        this.captureHostname = '';
        this.captureUsername = '';
        this.capturePassword = '';
        this.captureMessage.set('');
        this.showComputerForm.set(true);
    }
    protected async captureComputer(): Promise<void> {
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
    protected async downloadTargetSetup(): Promise<void> {
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
    protected async trustTarget(): Promise<void> {
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
    protected loadCapturedDetails(): void {
        const captured = this.captureResult();
        if (!captured) return;
        this.editingComputerId.set(null);
        this.computerForm = { ...this.blankComputer(), ...captured };
        this.captureResult.set(null);
        this.captureMessage.set('');
        this.showComputerForm.set(true);
    }
    protected loadSavedDetails(): void {
        const saved = this.matchedCapturedComputer();
        if (!saved) return;
        this.editingComputerId.set(saved.id);
        this.computerForm = { ...saved };
        this.captureResult.set(null);
        this.captureMessage.set('');
        this.showComputerForm.set(true);
    }
    protected trimModelEdges(): void {
        this.computerForm.model = this.computerForm.model.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }
    protected suggestManufacturers(query: string): void {
        const records = [...this.computers(), ...this.peripherals()];
        this.manufacturerSuggestions.set(this.matchSuggestions(records.map((item) => item.manufacturer), query));
    }
    protected suggestModels(query: string): void {
        const manufacturer = (
            this.showPeripheralForm() ? this.peripheralForm.manufacturer : this.computerForm.manufacturer
        )
            .trim()
            .toLocaleLowerCase();
        const records = [...this.computers(), ...this.peripherals()].filter(
            (item) => !manufacturer || item.manufacturer.trim().toLocaleLowerCase() === manufacturer,
        );
        this.modelSuggestions.set(this.matchSuggestions(records.map((item) => item.model), query));
    }
    protected suggestUsers(query: string): void {
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
    protected openPeripheralForm(peripheral?: Peripheral): void {
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
    protected async saveComputer(): Promise<void> {
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
        this.persist('chictool.computers', this.computers());
        this.showComputerForm.set(false);
    }
    protected async savePeripheral(): Promise<void> {
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
        this.persist('chictool.peripherals', this.peripherals());
        this.showPeripheralForm.set(false);
    }
    protected async deleteComputer(computer: Computer): Promise<void> {
        if (!confirm(`Remove ${computer.serialNumber} from inventory?`)) return;
        if (window.chictoolDesktop) {
            try {
                await window.chictoolDesktop.deleteComputer(computer.id);
                await this.refreshDesktopData();
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
        this.persist('chictool.computers', this.computers());
        this.persist('chictool.peripherals', this.peripherals());
    }
    protected async deletePeripheral(peripheral: Peripheral): Promise<void> {
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
            this.persist('chictool.peripherals', this.peripherals());
        }
    }
    private blankComputer(): Computer {
        return {
            id: crypto.randomUUID(),
            serialNumber: '',
            parHolder: '',
            hostname: '',
            manufacturer: '',
            model: '',
            machineType: 'Laptop',
            office: '',
            primaryUser: '',
            operatingSystem: 'Windows 11 Pro',
            collectedOn: new Date().toISOString().slice(0, 10),
        };
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
    private read<T>(key: string, fallback: T[]): T[] {
        try {
            return JSON.parse(localStorage.getItem(key) ?? '') as T[];
        } catch {
            return fallback;
        }
    }
    private persist<T>(key: string, data: T[]): void {
        localStorage.setItem(key, JSON.stringify(data));
    }
}

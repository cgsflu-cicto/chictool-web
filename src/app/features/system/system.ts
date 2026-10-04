import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PasswordModule } from '@openng/optimus-ui/password';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { toDataURL } from 'qrcode';
import type { HotspotStatus, ScanEndpointInfo } from '../../shared/models';
import { ChictoolStateService } from '../../shared/services/chictool-state.service';

@Component({
    selector: 'app-system',
    imports: [CommonModule, FormsModule, Button, InputTextModule, PasswordModule, TooltipModule],
    templateUrl: './system.html',
    styleUrl: './system.scss',
})
export class System implements OnInit {
    private readonly state = inject(ChictoolStateService);
    readonly desktop = this.state.desktop;
    readonly databaseServerUrl = signal('');
    readonly databaseBusy = signal(false);
    readonly databaseMessage = signal('');
    readonly databaseMessageIsError = signal(false);
    readonly scanEndpoint = signal<ScanEndpointInfo>({ enabled: false, port: 4783, urls: [], error: '' });
    readonly hotspotNetworkName = signal('CHICTool');
    hotspotPassword = '';
    readonly hotspotQrCode = signal('');
    readonly hotspotMessage = signal('');
    readonly hotspotMessageIsError = signal(false);
    readonly hotspotBusy = signal(false);
    readonly hotspotStatus = signal<HotspotStatus | null>(null);

    ngOnInit(): void {
        void this.initializeSystem();
    }

    private async initializeSystem(): Promise<void> {
        const api = this.state.bridge;
        if (!api) return;
        try {
            const [syncSettings, scanEndpoint, hotspotSettings] = await Promise.all([
                api.getSyncSettings(),
                api.getScanEndpointInfo(),
                api.getHotspotSettings(),
            ]);
            this.databaseServerUrl.set(syncSettings.serverUrl);
            this.scanEndpoint.set(scanEndpoint);
            this.hotspotNetworkName.set(hotspotSettings.networkName);
            this.hotspotPassword = hotspotSettings.password;
            try {
                const status = await api.getHotspotStatus();
                this.hotspotStatus.set(status);
                if (status.state === 'On') {
                    this.hotspotMessage.set('Hotspot is running as ' + hotspotSettings.networkName + '.');
                    this.hotspotMessageIsError.set(false);
                }
            } catch (error) {
                this.hotspotMessage.set(
                    error instanceof Error ? error.message : 'Could not read Mobile Hotspot status.',
                );
                this.hotspotMessageIsError.set(true);
            }
        } catch (error) {
            this.databaseMessage.set(error instanceof Error ? error.message : 'Could not load system settings.');
            this.databaseMessageIsError.set(true);
        }
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

    public async saveDatabaseServer(): Promise<void> {
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

    public async syncDatabase(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.databaseBusy.set(true);
        this.databaseMessage.set('Syncing computers and peripherals…');
        this.databaseMessageIsError.set(false);
        try {
            const result = await api.syncDatabase();
            const lookupSummary = result.lookups ? `Downloaded ${result.lookups.downloaded} lookup values; ` : '';
            const summary = `${lookupSummary}Synced ${result.computers.synced}/${result.computers.total} computers and ${result.peripherals.synced}/${result.peripherals.total} peripherals.`;
            const failure = result.failures[0];
            this.databaseMessage.set(
                result.failed ? `${summary} ${result.failed} failed.${failure ? ` ${failure}` : ''}` : summary,
            );
            this.databaseMessageIsError.set(result.failed > 0);
        } catch (error) {
            this.databaseMessage.set(error instanceof Error ? error.message : 'Could not sync with the target server.');
            this.databaseMessageIsError.set(true);
        } finally {
            this.databaseBusy.set(false);
        }
    }

    public async resetSqliteDatabase(): Promise<void> {
        const api = window.chictoolDesktop;
        if (
            !api ||
            !window.confirm(
                'Permanently remove all computer, peripheral, collection log, and audit log records from this SQLite database? User accounts and lookup values will remain.',
            )
        )
            return;
        this.databaseBusy.set(true);
        this.databaseMessage.set('Resetting the local SQLite database…');
        this.databaseMessageIsError.set(false);
        try {
            const counts = await api.resetDatabase();
            await this.state.refreshDesktopData();
            this.databaseMessage.set(
                `SQLite database reset. Removed ${counts.computers} computers, ${counts.peripherals} peripherals, ${counts.collectionLogs} collection logs, and ${counts.auditLogs} audit entries. User accounts and lookup values were kept.`,
            );
        } catch (error) {
            this.databaseMessage.set(error instanceof Error ? error.message : 'Could not reset the SQLite database.');
            this.databaseMessageIsError.set(true);
        } finally {
            this.databaseBusy.set(false);
        }
    }

    public async showHotspotQrCode(): Promise<void> {
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
                await toDataURL(
                    `WIFI:T:WPA;S:${escapeWifiValue(settings.networkName)};P:${escapeWifiValue(this.hotspotPassword)};;`,
                    {
                        errorCorrectionLevel: 'M',
                        margin: 1,
                        width: 280,
                    },
                ),
            );
            this.hotspotMessage.set(
                'Scan the QR code with a phone camera to join the hotspot. The password is not saved.',
            );
            this.hotspotMessageIsError.set(false);
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not create the hotspot QR code.');
            this.hotspotMessageIsError.set(true);
        } finally {
            this.hotspotBusy.set(false);
        }
    }

    public async startHotspot(): Promise<void> {
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

    public async toggleHotspot(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        try {
            const status = this.hotspotStatus() ?? (await api.getHotspotStatus());
            this.hotspotStatus.set(status);
            if (status.state === 'On') await this.stopHotspot();
            else await this.startHotspot();
        } catch (error) {
            this.hotspotMessage.set(error instanceof Error ? error.message : 'Could not read Mobile Hotspot status.');
            this.hotspotMessageIsError.set(true);
        }
    }

    public closeHotspotQrCode(): void {
        this.hotspotQrCode.set('');
    }

    public async stopHotspot(): Promise<void> {
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

    public async openWindowsHotspotSettings(): Promise<void> {
        const api = window.chictoolDesktop;
        if (!api) return;
        this.hotspotBusy.set(true);
        this.hotspotMessage.set('');
        try {
            await api.openWindowsHotspotSettings();
        } catch (error) {
            this.hotspotMessage.set(
                error instanceof Error ? error.message : 'Could not open Windows Mobile Hotspot settings.',
            );
            this.hotspotMessageIsError.set(true);
        } finally {
            this.hotspotBusy.set(false);
        }
    }
}

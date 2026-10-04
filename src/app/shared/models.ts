export type DeviceType = 'Desktop' | 'Laptop' | 'All-in-One' | 'Server' | 'Tablet' | 'Phone' | 'Other';

export type Computer = {
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
};

export type Peripheral = {
    id: string;
    syncId: string;
    type: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    assignedUser: string;
    computerSerialNumber: string;
    computerId: string;
};

export type AuthState = {
    hasUsers: boolean;
    currentUser: { id: number; username: string } | null;
};

export type DatabaseSyncResult = {
    lookups: { downloaded: number };
    computers: { synced: number; total: number };
    peripherals: { synced: number; total: number };
    synced: number;
    failed: number;
    failures: string[];
};

export type ScanEndpointInfo = {
    enabled: boolean;
    port: number;
    urls: string[];
    endpoints?: { interfaceName: string; networkName: string; address: string; url: string }[];
    error: string;
};

export type IncomingScan = { requestId: string; value: string };
export type HotspotSettings = { networkName: string; password: string };
export type HotspotStatus = { state: string; clientCount: number | null; networkName: string };

export type DesktopBridge = {
    authState(): Promise<AuthState>;
    login(username: string, password: string): Promise<AuthState>;
    register(username: string, password: string): Promise<AuthState>;
    logout(): Promise<AuthState>;
    lookups(): Promise<Record<string, { value: string; label: string }[]>>;
    listComputers(): Promise<Computer[]>;
    saveComputer(computer: Computer): Promise<Computer>;
    deleteComputer(id: string): Promise<void>;
    captureComputer(request: {
        mode: 'local' | 'remote';
        hostname?: string;
        username?: string;
        password?: string;
    }): Promise<Partial<Computer>>;
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
};

declare global {
    interface Window {
        chictoolDesktop?: DesktopBridge;
    }
}

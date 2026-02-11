import { BotService } from '../bot/bot.services';
import { V2RayConfig, XrayStatusData, ServiceCreateParams, Server, VlessLinkSet } from '../types/v2ray.type';
export declare class V2RayService {
    private botService;
    private isMonitoringActive;
    private httpInstances;
    constructor();
    setBotService(botService: BotService): void;
    private getHttpClient;
    selectOptimalServer(): Promise<Server>;
    getConfig(server: Server): Promise<V2RayConfig>;
    updateConfig(server: Server, config: V2RayConfig): Promise<boolean>;
    restartService(server: Server): Promise<boolean>;
    getStatus(server: Server): Promise<XrayStatusData>;
    createService(params: ServiceCreateParams): Promise<{
        success: boolean;
        links?: VlessLinkSet;
        message?: string;
        server?: Server;
    }>;
    private storeUserConfigInDatabase;
    private generateVlessLinks;
    removeUserFromConfig(userEmail: string, serverId: number): Promise<boolean>;
    startMonitoring(): void;
    private checkAllServers;
    private checkServer;
    private checkServerBandwidth;
    private getActiveServicesOnServer;
    private checkServiceBandwidth;
    private handleDataLimitReached;
    private handleServiceExpired;
    private updateServerStatistics;
    private notifyUser;
    getServerStatus(): Promise<any>;
    addServer(serverData: Partial<Server>): Promise<Server>;
    updateServer(serverId: number, serverData: Partial<Server>): Promise<Server>;
}
declare const _default: V2RayService;
export default _default;
//# sourceMappingURL=v2ray.services.d.ts.map
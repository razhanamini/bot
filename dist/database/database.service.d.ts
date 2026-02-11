import { Server } from '../types/v2ray.type';
declare class DatabaseService {
    private pool;
    constructor();
    query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
    getUserByTelegramId(telegramId: number): Promise<any>;
    createUser(telegramId: number, username: string | null, firstName: string, lastName: string | null): Promise<any>;
    getServices(): Promise<any[]>;
    getServiceById(serviceId: number): Promise<any>;
    getUserConfigs(userId: number): Promise<any[]>;
    createPayment(userId: number, amount: number, cardNumber: string): Promise<any>;
    updatePaymentStatus(paymentId: number, status: string, adminMessageId?: number, adminChatId?: number): Promise<any>;
    updateUserBalance(userId: number, amount: number): Promise<any>;
    createUserConfig(userId: number, serviceId: number, vlessLink: string, status: string, durationDays: number): Promise<any>;
    hasTestConfig(userId: number): Promise<boolean>;
    getPaymentById(paymentId: number): Promise<any>;
    getUserServices(userId: number): Promise<any[]>;
    getAvailableServers(): Promise<Server[]>;
    getAllActiveServers(): Promise<Server[]>;
    getServerById(id: number): Promise<Server | null>;
    incrementServerUsers(serverId: number): Promise<void>;
    decrementServerUsers(serverId: number): Promise<void>;
    updateServerCurrentUsers(serverId: number, count: number): Promise<void>;
    updateServerStatus(serverId: number, status: string): Promise<void>;
    getServerStats(): Promise<any>;
}
declare const _default: DatabaseService;
export default _default;
//# sourceMappingURL=database.service.d.ts.map
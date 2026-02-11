import { UserConfig } from "../database/models/config.model";
import { Payment } from "../database/models/payment.model";
import { Service } from "../database/models/service.model";
import { VlessLinkSet } from "../types/v2ray.links";
export declare class BotMessages {
    static escapeMarkdown(text: string): string;
    static welcomeMessage(user: any): string;
    static noServicesAvailable(): string;
    static availableServices(): string;
    static serviceDetails(service: Service): string;
    static insufficientFunds(userBalance: number, servicePrice: number): string;
    static noActiveConfigs(): string;
    static userConfigs(configs: UserConfig[]): string;
    static alreadyUsedTest(): string;
    static testConfigActivated(vlessLink: string): string;
    static addFundsPrompt(): string;
    static paymentInvoice(payment: any, amount: number): string;
    static paymentMadePrompt(): string;
    static noPendingPayment(): string;
    static receiptReceived(): string;
    static paymentConfirmedUser(amount: number): string;
    static paymentConfirmedAdmin(payment: Payment): string;
    static paymentDeclinedUser(payment: any): string;
    static paymentDeclinedAdmin(payment: Payment): string;
    static accountInformation(user: any, configsCount: number): string;
    static supportMessage(telegramId: number): string;
    static howToUse(channelLink: string): string;
    static paymentVerificationRequired(payment: any, user: any): string;
    static callbackAnswers: {
        serviceNotFound: string;
        purchaseCancelled: string;
        purchaseSuccessful: string;
        insufficientFunds: string;
        pleaseSendReceipt: string;
        paymentNotFound: string;
        paymentConfirmed: string;
        paymentDeclined: string;
        paymentCancelled: string;
    };
    static purchaseSuccessful(service: any, links: VlessLinkSet): string;
    static getPlatformLinkMessage(links: VlessLinkSet, platform: string): string;
    private static getStatusEmoji;
    static bold(text: string): string;
    static monospace(text: string): string;
    static userServices(services: any[]): string;
    static userServicesDetailed(services: any[]): string;
}
//# sourceMappingURL=messages.d.ts.map
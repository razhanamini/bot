import { Context } from 'telegraf';
export declare class BotService {
    private bot;
    private adminChatIds;
    constructor();
    private setupMiddlewares;
    private setupCommands;
    private setupCallbacks;
    handleStart(ctx: Context): Promise<void>;
    handleBuyService(ctx: Context): Promise<void>;
    handleServiceSelect(ctx: any): Promise<void>;
    handleCancelPurchase(ctx: any): Promise<void>;
    handleMyServices(ctx: Context): Promise<void>;
    handleConfirmPurchase(ctx: any): Promise<void>;
    sendNotification(telegramId: number, message: string): Promise<void>;
    handleAddFunds(ctx: Context): Promise<void>;
    handleText(ctx: Context): Promise<void>;
    handlePaymentMade(ctx: any): Promise<void>;
    handlePhoto(ctx: Context): Promise<void>;
    handleAdminConfirmPayment(ctx: any): Promise<void>;
    handleAdminDeclinePayment(ctx: any): Promise<void>;
    handleCancelPayment(ctx: any): Promise<void>;
    handleMyAccount(ctx: Context): Promise<void>;
    handleSupport(ctx: Context): Promise<void>;
    handleHowToUse(ctx: Context): Promise<void>;
    launch(): void;
}
//# sourceMappingURL=bot.services.d.ts.map
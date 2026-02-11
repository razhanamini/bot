"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotService = void 0;
const telegraf_1 = require("telegraf");
const dotenv_1 = __importDefault(require("dotenv"));
const database_service_1 = __importDefault(require("../database/database.service"));
const messages_1 = require("./messages");
const v2ray_services_1 = __importDefault(require("../services/v2ray.services"));
dotenv_1.default.config();
class BotService {
    constructor() {
        const token = process.env.BOT_TOKEN;
        if (!token) {
            throw new Error('BOT_TOKEN is not defined in environment variables');
        }
        this.bot = new telegraf_1.Telegraf(token);
        this.adminChatIds = process.env.ADMIN_CHAT_IDS?.split(',').map(id => parseInt(id)) || [];
        this.setupMiddlewares();
        this.setupCommands();
        this.setupCallbacks();
        v2ray_services_1.default.setBotService(this);
    }
    setupMiddlewares() {
        this.bot.use(async (ctx, next) => {
            if (ctx.from) {
                await database_service_1.default.createUser(ctx.from.id, ctx.from.username || null, ctx.from.first_name, ctx.from.last_name || null);
            }
            await next();
        });
    }
    setupCommands() {
        this.bot.command('start', (ctx) => this.handleStart(ctx));
        this.bot.command('buy', (ctx) => this.handleBuyService(ctx));
        this.bot.command('my_services', (ctx) => this.handleMyServices(ctx));
        this.bot.command('add_funds', (ctx) => this.handleAddFunds(ctx));
        this.bot.command('my_account', (ctx) => this.handleMyAccount(ctx));
        this.bot.command('support', (ctx) => this.handleSupport(ctx));
        this.bot.command('how_to_use', (ctx) => this.handleHowToUse(ctx));
    }
    setupCallbacks() {
        this.bot.action(/^service_(\d+)$/, async (ctx) => this.handleServiceSelect(ctx));
        this.bot.action(/^confirm_purchase_(\d+)$/, async (ctx) => this.handleConfirmPurchase(ctx));
        this.bot.action(/^cancel_purchase$/, async (ctx) => this.handleCancelPurchase(ctx));
        this.bot.action(/^payed_(\d+)$/, async (ctx) => this.handlePaymentMade(ctx));
        this.bot.action(/^cancel_payment_(\d+)$/, async (ctx) => this.handleCancelPayment(ctx));
        this.bot.action(/^confirm_payment_(\d+)$/, async (ctx) => this.handleAdminConfirmPayment(ctx));
        this.bot.action(/^decline_payment_(\d+)$/, async (ctx) => this.handleAdminDeclinePayment(ctx));
        this.bot.on('photo', async (ctx) => this.handlePhoto(ctx));
        this.bot.on('text', async (ctx) => this.handleText(ctx));
    }
    async handleStart(ctx) {
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        const message = messages_1.BotMessages.welcomeMessage(user);
        await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            ...telegraf_1.Markup.keyboard([
                ['/buy', '/my_services'],
                ['/test_config', '/add_funds'],
                ['/my_account', '/support']
            ]).resize()
        });
    }
    async handleBuyService(ctx) {
        const services = await database_service_1.default.getServices();
        if (services.length === 0) {
            await ctx.reply(messages_1.BotMessages.noServicesAvailable(), { parse_mode: 'MarkdownV2' });
            return;
        }
        const serviceButtons = services.map(service => [telegraf_1.Markup.button.callback(`${service.name} - $${service.price} (${service.duration_days} days)`, `service_${service.id}`)]);
        await ctx.reply(messages_1.BotMessages.availableServices(), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: serviceButtons
            }
        });
    }
    async handleServiceSelect(ctx) {
        const serviceId = parseInt(ctx.match[1]);
        const service = await database_service_1.default.getServiceById(serviceId);
        if (!service) {
            await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.serviceNotFound);
            return;
        }
        const message = messages_1.BotMessages.serviceDetails(service);
        await ctx.editMessageText(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        telegraf_1.Markup.button.callback('✅ Confirm Purchase', `confirm_purchase_${service.id}`),
                        telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_purchase')
                    ]
                ]
            }
        });
    }
    // async handleConfirmPurchase(ctx: any) {
    //   const serviceId = parseInt(ctx.match[1]);
    //   const service = await db.getServiceById(serviceId);
    //   const user = await db.getUserByTelegramId(ctx.from.id);
    //   if (Number(user.balance) < service.price) {
    //     await ctx.answerCbQuery(BotMessages.callbackAnswers.insufficientFunds);
    //     await ctx.editMessageText(
    //       BotMessages.insufficientFunds(user.balance, service.price),
    //       { parse_mode: 'MarkdownV2' }
    //     );
    //     return;
    //   }
    //   // Generate dummy V2Ray link
    //   // const vlessLink = `vless://${Math.random().toString(36).substring(2)}@server.example.com:443?security=tls&sni=v2ray.com&type=ws&path=/v2ray#${service.name}`;
    //  // call the create config service to create a config for the user and retrieve a link
    //  const vlessLink = "vlesslnk"; 
    //   // Deduct balance
    //   await db.updateUserBalance(user.id, -service.price);
    //   // Create config
    //   await db.createUserConfig(user.id, service.id, vlessLink, 'active', service.duration_days);
    //   await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseSuccessful);
    //   await ctx.editMessageText(
    //     BotMessages.purchaseSuccessful(service, vlessLink),
    //     { parse_mode: 'MarkdownV2' }
    //   );
    // }
    async handleCancelPurchase(ctx) {
        await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.purchaseCancelled);
        await ctx.deleteMessage();
    }
    async handleMyServices(ctx) {
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        // Get user's services with accurate data usage from database
        const userServices = await database_service_1.default.getUserServices(user.id);
        if (userServices.length === 0) {
            await ctx.reply(messages_1.BotMessages.noActiveConfigs(), { parse_mode: 'MarkdownV2' });
            return;
        }
        const message = messages_1.BotMessages.userServices(userServices);
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    }
    // async handleTestConfig(ctx: Context) {
    //   const user = await db.getUserByTelegramId(ctx.from!.id);
    //   const hasTest = await db.hasTestConfig(user.id);
    //   if (hasTest) {
    //     await ctx.reply(BotMessages.alreadyUsedTest(), { parse_mode: 'MarkdownV2' });
    //     return;
    //   }
    //   // Generate dummy test config
    //   const vlessLink = `vless://${Math.random().toString(36).substring(2)}@test.server.example.com:443?security=tls&sni=test.v2ray.com&type=ws&path=/test#Free-Test`;
    //   // Create test config (3 days free)
    //   await db.createUserConfig(user.id, 0, vlessLink, 'test', 3);
    //   await ctx.reply(
    //     BotMessages.testConfigActivated(vlessLink),
    //     { parse_mode: 'MarkdownV2' }
    //   );
    // }
    async handleConfirmPurchase(ctx) {
        const serviceId = parseInt(ctx.match[1]);
        const service = await database_service_1.default.getServiceById(serviceId);
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        if (Math.floor(user.balance) < Math.floor(service.price)) {
            await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.insufficientFunds);
            await ctx.editMessageText(messages_1.BotMessages.insufficientFunds(user.balance, service.price), { parse_mode: 'MarkdownV2' });
            return;
        }
        try {
            // Create V2Ray service
            const params = {
                userId: user.id,
                userEmail: `${user.telegram_id}@v2ray.${serviceId}.${Math.random().toString(8).substring(2)}`,
                serviceId: service.id,
                serviceName: service.name,
                durationDays: service.duration_days,
                dataLimitGB: service.data_limit_gb
            };
            const result = await v2ray_services_1.default.createService(params);
            if (!result.success) {
                throw new Error(result.message || 'Failed to create service');
            }
            // Deduct balance
            await database_service_1.default.updateUserBalance(user.id, -service.price);
            // Create config record (already done in createService, but we have the link)
            // await db.createUserConfig(
            //   user.id, 
            //   service.id, 
            //   result.links!.standard, 
            //   'active', 
            //   service.duration_days
            // );
            await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.purchaseSuccessful);
            // Send the main message with all links
            await ctx.editMessageText(messages_1.BotMessages.purchaseSuccessful(service, result.links), { parse_mode: 'MarkdownV2' });
            // Also send each platform link separately for easier copying
            // const platforms = ['Android', 'iOS', 'Windows', 'Linux', 'macOS'];
            // for (const platform of platforms) {
            //   await ctx.reply(
            //     BotMessages.getPlatformLinkMessage(result.links!, platform),
            //     { parse_mode: 'MarkdownV2' }
            //   );
            // }
        }
        catch (error) {
            console.error('Error creating service:', error);
            await ctx.answerCbQuery('❌ Service creation failed');
            await ctx.editMessageText(`❌ Service creation failed: \n\nPlease contact support.`, { parse_mode: 'MarkdownV2' });
        }
    }
    // Add notification method to BotService class
    async sendNotification(telegramId, message) {
        try {
            await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
        }
        catch (error) {
            console.error(`Error sending notification to ${telegramId}:`, error);
        }
    }
    async handleAddFunds(ctx) {
        await ctx.reply(messages_1.BotMessages.addFundsPrompt(), { parse_mode: 'MarkdownV2' });
    }
    async handleText(ctx) {
        const text = ctx.message.text;
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        // Check if user is in payment process
        if (!isNaN(parseFloat(text)) && parseFloat(text) > 0) {
            const amount = parseFloat(text);
            const cardNumber = process.env.PAYMENT_CARD_NUMBER || '1234-5678-9012-3456';
            const payment = await database_service_1.default.createPayment(user.id, amount, cardNumber);
            const message = messages_1.BotMessages.paymentInvoice(payment, amount);
            await ctx.reply(message, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            telegraf_1.Markup.button.callback('✅ I\'ve Paid', `payed_${payment.id}`),
                            telegraf_1.Markup.button.callback('❌ Cancel Payment', `cancel_payment_${payment.id}`)
                        ]
                    ]
                }
            });
        }
    }
    async handlePaymentMade(ctx) {
        const paymentId = parseInt(ctx.match[1]);
        await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.pleaseSendReceipt);
        await ctx.editMessageText(messages_1.BotMessages.paymentMadePrompt(), { parse_mode: 'MarkdownV2' });
    }
    async handlePhoto(ctx) {
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        // Get the latest pending payment for user
        const result = await database_service_1.default.query('SELECT * FROM payments WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1', [user.id, 'pending']);
        if (result.rows.length === 0) {
            await ctx.reply(messages_1.BotMessages.noPendingPayment(), { parse_mode: 'MarkdownV2' });
            return;
        }
        const payment = result.rows[0];
        const photo = ctx.message.photo.pop();
        // Update payment with receipt photo (in real app, download and store)
        await database_service_1.default.query('UPDATE payments SET receipt_photo = $1 WHERE id = $2', [`photo_${photo.file_id}`, payment.id]);
        // Notify admins
        for (const adminChatId of this.adminChatIds) {
            try {
                const adminMessage = await this.bot.telegram.sendPhoto(adminChatId, photo.file_id, {
                    caption: messages_1.BotMessages.paymentVerificationRequired(payment, user),
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                telegraf_1.Markup.button.callback('✅ Confirm Payment', `confirm_payment_${payment.id}`),
                                telegraf_1.Markup.button.callback('❌ Decline Payment', `decline_payment_${payment.id}`)
                            ]
                        ]
                    }
                });
                // Store admin message info
                await database_service_1.default.query('UPDATE payments SET admin_message_id = $1, admin_chat_id = $2 WHERE id = $3', [adminMessage.message_id, adminChatId, payment.id]);
            }
            catch (error) {
                console.error('Error sending to admin:', error);
            }
        }
        await ctx.reply(messages_1.BotMessages.receiptReceived(), { parse_mode: 'MarkdownV2' });
    }
    async handleAdminConfirmPayment(ctx) {
        const paymentId = parseInt(ctx.match[1]);
        const payment = await database_service_1.default.getPaymentById(paymentId);
        if (!payment) {
            await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.paymentNotFound);
            return;
        }
        // Update payment status
        await database_service_1.default.updatePaymentStatus(paymentId, 'confirmed');
        // Update user balance
        await database_service_1.default.updateUserBalance(payment.user_id, payment.amount);
        // Notify user
        await this.bot.telegram.sendMessage(payment.telegram_id, messages_1.BotMessages.paymentConfirmedUser(payment.amount), { parse_mode: 'MarkdownV2' });
        // Update admin message
        await ctx.sendMessage(payment.telegram_id, messages_1.BotMessages.paymentConfirmedAdmin(payment), {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [] }
        });
        await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.paymentConfirmed);
    }
    async handleAdminDeclinePayment(ctx) {
        const paymentId = parseInt(ctx.match[1]);
        const payment = await database_service_1.default.getPaymentById(paymentId);
        if (!payment) {
            await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.paymentNotFound);
            return;
        }
        await database_service_1.default.updatePaymentStatus(paymentId, 'declined');
        // Notify user
        await this.bot.telegram.sendMessage(payment.telegram_id, messages_1.BotMessages.paymentDeclinedUser(payment), { parse_mode: 'MarkdownV2' });
        await ctx.sendMessage(payment.telegram_id, messages_1.BotMessages.paymentDeclinedAdmin(payment), {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [] }
        });
        await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.paymentDeclined);
    }
    async handleCancelPayment(ctx) {
        const paymentId = parseInt(ctx.match[1]);
        await database_service_1.default.updatePaymentStatus(paymentId, 'cancelled');
        await ctx.answerCbQuery(messages_1.BotMessages.callbackAnswers.paymentCancelled);
        await ctx.deleteMessage();
    }
    async handleMyAccount(ctx) {
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        const configs = await database_service_1.default.getUserConfigs(user.id);
        const message = messages_1.BotMessages.accountInformation(user, configs.length);
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    }
    async handleSupport(ctx) {
        const user = await database_service_1.default.getUserByTelegramId(ctx.from.id);
        const message = messages_1.BotMessages.supportMessage(user.telegram_id);
        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    }
    async handleHowToUse(ctx) {
        const channelLink = process.env.TUTORIAL_CHANNEL || 'https://t.me/v2ray_tutorials';
        const message = messages_1.BotMessages.howToUse(channelLink);
        await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [telegraf_1.Markup.button.url('Join Tutorial Channel', channelLink)]
                ]
            }
        });
    }
    launch() {
        this.bot.launch();
        console.log('🤖 Bot started successfully');
        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}
exports.BotService = BotService;
//# sourceMappingURL=bot.services.js.map
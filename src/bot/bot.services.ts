import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import db from '../database/database.service';
import { BotMessages } from './messages';
import v2rayServices from '../services/v2ray.services';
dotenv.config();

export class BotService {




  private bot: Telegraf;
  private adminChatIds: number[];

  constructor() {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error('BOT_TOKEN is not defined in environment variables');
    }

    this.bot = new Telegraf(token);
    this.adminChatIds = process.env.ADMIN_CHAT_IDS?.split(',').map(id => parseInt(id)) || [];

    this.setupMiddlewares();
    this.setupCommands();
    this.setupCallbacks();

    v2rayServices.setBotService(this);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  private setupMiddlewares() {
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        await db.createUser(
          ctx.from.id,
          ctx.from.username || null,
          ctx.from.first_name,
          ctx.from.last_name || null
        );
      }
      await next();
    });
  }

  // private setupCommands() {
  //   this.bot.command('start', (ctx) => this.handleStart(ctx));
  //   this.bot.command('buy', (ctx) => this.handleBuyService(ctx));
  //   this.bot.command('my_services', (ctx) => this.handleMyServices(ctx));
  //   this.bot.command('add_funds', (ctx) => this.handleAddFunds(ctx));
  //   this.bot.command('my_account', (ctx) => this.handleMyAccount(ctx));
  //   this.bot.command('support', (ctx) => this.handleSupport(ctx));
  //   this.bot.command('how_to_use', (ctx) => this.handleHowToUse(ctx));
  //   this.bot.command('test_service', (ctx) => this.handleTestConfig(ctx));

  // }
  private setupCommands() {
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    this.bot.command('buy', (ctx) => this.handleBuyService(ctx));
    this.bot.command('my_services', (ctx) => this.handleMyServices(ctx));
    this.bot.command('add_funds', (ctx) => this.handleAddFunds(ctx));
    this.bot.command('my_account', (ctx) => this.handleMyAccount(ctx));
    this.bot.command('support', (ctx) => this.handleSupport(ctx));
    this.bot.command('how_to_use', (ctx) => this.handleHowToUse(ctx));
    this.bot.command('test_config', (ctx) => this.handleTestConfig(ctx)); // ✅ Fixed: changed from 'test_service' to 'test_config'
  }

  private setupCallbacks() {
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

  async handleStart(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const message = BotMessages.welcomeMessage(user);


    const isNewUser = user.created_at.getTime() > Date.now() - 5000;
    if (isNewUser) {
      await ctx.replyWithPhoto(
        { source: './assets/welcome.png' },
        {
          caption:
            `💎 *V2Chain* 💎

🎁 *سرویس تست رایگان*

🔥 تضمین کمترین پینگ  
⚡️ مناسب برای دانلود و آپلود  
🕓 پشتیبانی ۲۴ ساعته  
🖥 سرورهای اختصاصی

🚀 همین حالا شروع کنید`,
          parse_mode: 'MarkdownV2'
        }
      );
    }


    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      ...Markup.keyboard([
       ['/buy 🛒 خرید', '/my_services 📋 سرویس‌های من'],
    ['/test_config 🎁 تست رایگان', '/add_funds 💰 افزایش موجودی'],
    ['/my_account 👤 حساب من', '/support 🆘 پشتیبانی']
      ]).resize()
    });
  }

  async handleBuyService(ctx: Context) {
    const services = await db.getServices();

    if (services.length === 0) {
      await ctx.reply(BotMessages.noServicesAvailable(), { parse_mode: 'MarkdownV2' });
      return;
    }

    const serviceButtons = services.map(service =>
      [Markup.button.callback(
        `${service.name} - $${service.price} (${service.duration_days} days)`,
        `service_${service.id}`
      )]
    );

    await ctx.reply(BotMessages.availableServices(), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: serviceButtons
      }
    });
  }

  async handleServiceSelect(ctx: any) {
    const serviceId = parseInt(ctx.match[1]);
    const service = await db.getServiceById(serviceId);

    if (!service) {
      await ctx.answerCbQuery(BotMessages.callbackAnswers.serviceNotFound);
      return;
    }

    const message = BotMessages.serviceDetails(service);

    await ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            Markup.button.callback('✅ Confirm Purchase', `confirm_purchase_${service.id}`),
            Markup.button.callback('❌ Cancel', 'cancel_purchase')
          ]
        ]
      }
    });
  }



  async handleCancelPurchase(ctx: any) {
    await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseCancelled);
    await ctx.deleteMessage();
  }

  async handleMyServices(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);

    // Get user's services with accurate data usage from database
    const userServices = await db.getUserServices(user.id);

    if (userServices.length === 0) {
      await ctx.reply(BotMessages.noActiveConfigs(), { parse_mode: 'MarkdownV2' });
      return;
    }

    const message = BotMessages.userServices(userServices);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  }

  async handleTestConfig(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);

    // Check if user already used test config
    const hasTest = await db.hasTestConfig(user.id);
    if (hasTest) {
      await ctx.reply(BotMessages.alreadyUsedTest(), { parse_mode: 'MarkdownV2' });
      return;
    }

    try {
      await ctx.reply('🔄 Setting up your free test service  ', { parse_mode: 'MarkdownV2' });

      // Create test service parameters
      const params = {
        userId: user.id,
        userEmail: `${user.telegram_id}@test.v2ray`, // Special email suffix for test
        serviceId: 1111, // 1111 for test services
        serviceName: 'Free Test',
        durationDays: 1, // 24 hours
        dataLimitGB: "0.2" // 1GB limit (Xray supports this)
      };

      // Create test service using V2Ray service
      const result = await v2rayServices.createService(params);

      if (!result.success || !result.links) {
        throw new Error(result.message || 'Failed to create test service');
      }

      // Update the status to 'test' instead of 'active'
      await db.query(
        `UPDATE user_configs 
       SET status = 'test', 
           data_limit_gb = 0.2,
           updated_at = NOW() 
       WHERE client_email = $1 AND status = 'active'`,
        [params.userEmail]
      );

      // Send success message with all platform links
      await ctx.reply(
        BotMessages.testConfigActivated(),
        { parse_mode: 'MarkdownV2' }
      );

      // Also send each platform link separately for easier copying
      const platforms = ['Android', 'iOS', 'Windows', 'Linux', 'macOS'];
      for (const platform of platforms) {
        await ctx.reply(
          BotMessages.getPlatformLinkMessage(result.links, platform),
          { parse_mode: 'MarkdownV2' }
        );
      }

      console.log(`✅ Test service created for user ${user.id} (${user.telegram_id})`);

    } catch (error: any) {
      console.error('❌ Error creating test service:', error);
      await ctx.reply(
        `❌ Failed to create test service: \n\nPlease try again later or contact support`,
        { parse_mode: 'MarkdownV2' }
      );
    }
  }

  async handleConfirmPurchase(ctx: any) {
    const serviceId = parseInt(ctx.match[1]);
    const service = await db.getServiceById(serviceId);
    const user = await db.getUserByTelegramId(ctx.from.id);

    if (Math.floor(user.balance) < Math.floor(service.price)) {
      await ctx.answerCbQuery(BotMessages.callbackAnswers.insufficientFunds);
      await ctx.editMessageText(
        BotMessages.insufficientFunds(user.balance, service.price),
        { parse_mode: 'MarkdownV2' }
      );
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

      const result = await v2rayServices.createService(params);

      if (!result.success) {
        throw new Error(result.message || 'Failed to create service');
      }

      // Deduct balance
      await db.updateUserBalance(user.id, -service.price);

      // Create config record (already done in createService, but we have the link)
      // await db.createUserConfig(
      //   user.id, 
      //   service.id, 
      //   result.links!.standard, 
      //   'active', 
      //   service.duration_days
      // );

      await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseSuccessful);

      // Send the main message with all links
      await ctx.editMessageText(
        BotMessages.purchaseSuccessful(service, result.links!),
        { parse_mode: 'MarkdownV2' }
      );

      // Also send each platform link separately for easier copying
      // const platforms = ['Android', 'iOS', 'Windows', 'Linux', 'macOS'];
      // for (const platform of platforms) {
      //   await ctx.reply(
      //     BotMessages.getPlatformLinkMessage(result.links!, platform),
      //     { parse_mode: 'MarkdownV2' }
      //   );
      // }

    } catch (error: any) {
      console.error('Error creating service:', error);
      await ctx.answerCbQuery('❌ Service creation failed');
      await ctx.editMessageText(
        `❌ Service creation failed: \n\nPlease contact support.`,
        { parse_mode: 'MarkdownV2' }
      );
    }
  }

  // Add notification method to BotService class
  async sendNotification(telegramId: number, message: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error(`Error sending notification to ${telegramId}:`, error);
    }
  }


  async handleAddFunds(ctx: Context) {
    await ctx.reply(BotMessages.addFundsPrompt(), { parse_mode: 'MarkdownV2' });
  }

  async handleText(ctx: Context) {
    const text = (ctx.message as any).text;
    const user = await db.getUserByTelegramId(ctx.from!.id);

    // Check if user is in payment process
    if (!isNaN(parseFloat(text)) && parseFloat(text) > 0) {
      const amount = parseFloat(text);
      const cardNumber = process.env.PAYMENT_CARD_NUMBER || '1234-5678-9012-3456';

      const payment = await db.createPayment(user.id, amount, cardNumber);

      const message = BotMessages.paymentInvoice(payment, amount);

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback('✅ I\'ve Paid', `payed_${payment.id}`),
              Markup.button.callback('❌ Cancel Payment', `cancel_payment_${payment.id}`)
            ]
          ]
        }
      });
    }
  }

  async handlePaymentMade(ctx: any) {
    const paymentId = parseInt(ctx.match[1]);

    await ctx.answerCbQuery(BotMessages.callbackAnswers.pleaseSendReceipt);
    await ctx.editMessageText(
      BotMessages.paymentMadePrompt(),
      { parse_mode: 'MarkdownV2' }
    );
  }

  async handlePhoto(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);

    // Get the latest pending payment for user
    const result = await db.query(
      'SELECT * FROM payments WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [user.id, 'pending']
    );

    if (result.rows.length === 0) {
      await ctx.reply(BotMessages.noPendingPayment(), { parse_mode: 'MarkdownV2' });
      return;
    }

    const payment = result.rows[0];
    const photo = (ctx.message as any).photo.pop();

    // Update payment with receipt photo (in real app, download and store)
    await db.query(
      'UPDATE payments SET receipt_photo = $1 WHERE id = $2',
      [`photo_${photo.file_id}`, payment.id]
    );

    // Notify admins
    for (const adminChatId of this.adminChatIds) {
      try {
        const adminMessage = await this.bot.telegram.sendPhoto(
          adminChatId,
          photo.file_id,
          {
            caption: BotMessages.paymentVerificationRequired(payment, user),
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [
                  Markup.button.callback('✅ Confirm Payment', `confirm_payment_${payment.id}`),
                  Markup.button.callback('❌ Decline Payment', `decline_payment_${payment.id}`)
                ]
              ]
            }
          }
        );

        // Store admin message info
        await db.query(
          'UPDATE payments SET admin_message_id = $1, admin_chat_id = $2 WHERE id = $3',
          [adminMessage.message_id, adminChatId, payment.id]
        );
      } catch (error) {
        console.error('Error sending to admin:', error);
      }
    }

    await ctx.reply(BotMessages.receiptReceived(), { parse_mode: 'MarkdownV2' });
  }

  async handleAdminConfirmPayment(ctx: any) {
    const paymentId = parseInt(ctx.match[1]);
    const payment = await db.getPaymentById(paymentId);

    if (!payment) {
      await ctx.answerCbQuery(BotMessages.callbackAnswers.paymentNotFound);
      return;
    }

    // Update payment status
    await db.updatePaymentStatus(paymentId, 'confirmed');

    // Update user balance
    await db.updateUserBalance(payment.user_id, payment.amount);

    // Notify user
    await this.bot.telegram.sendMessage(
      payment.telegram_id,
      BotMessages.paymentConfirmedUser(payment.amount),
      { parse_mode: 'MarkdownV2' }
    );

    // Update admin message
    await ctx.sendMessage(
      payment.telegram_id,
      BotMessages.paymentConfirmedAdmin(payment),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] }
      }
    );

    await ctx.answerCbQuery(BotMessages.callbackAnswers.paymentConfirmed);
  }

  async handleAdminDeclinePayment(ctx: any) {
    const paymentId = parseInt(ctx.match[1]);
    const payment = await db.getPaymentById(paymentId);

    if (!payment) {
      await ctx.answerCbQuery(BotMessages.callbackAnswers.paymentNotFound);
      return;
    }

    await db.updatePaymentStatus(paymentId, 'declined');

    // Notify user
    await this.bot.telegram.sendMessage(
      payment.telegram_id,
      BotMessages.paymentDeclinedUser(payment),
      { parse_mode: 'MarkdownV2' }
    );

    await ctx.sendMessage(
      payment.telegram_id,
      BotMessages.paymentDeclinedAdmin(payment),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] }
      }
    );

    await ctx.answerCbQuery(BotMessages.callbackAnswers.paymentDeclined);
  }

  async handleCancelPayment(ctx: any) {
    const paymentId = parseInt(ctx.match[1]);
    await db.updatePaymentStatus(paymentId, 'cancelled');

    await ctx.answerCbQuery(BotMessages.callbackAnswers.paymentCancelled);
    await ctx.deleteMessage();
  }

  async handleMyAccount(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const configs = await db.getUserConfigs(user.id);

    const message = BotMessages.accountInformation(user, configs.length);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  }

  async handleSupport(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const message = BotMessages.supportMessage(user.telegram_id);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  }

  async handleHowToUse(ctx: Context) {
    const channelLink = process.env.TUTORIAL_CHANNEL || 'https://t.me/v2ray_tutorials';
    const message = BotMessages.howToUse(channelLink);

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.url('Join Tutorial Channel', channelLink)]
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
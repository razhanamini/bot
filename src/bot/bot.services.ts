import { Telegraf, Context, Markup } from 'telegraf';
import dotenv, { config } from 'dotenv';
import db from '../database/database.service';
import { BotMessages } from './messages';
import v2rayServices from '../services/v2ray.services';
import QRCode from 'qrcode';
import crypto from 'crypto';
dotenv.config();


const PERSIAN_BUTTONS = {
  BUY: '🛒 خرید',
  MY_SERVICES: '📋 سرویس‌های من',
  TEST_CONFIG: '🎁 تست رایگان',
  ADD_FUNDS: '💰 افزایش موجودی',
  MY_ACCOUNT: '👤 حساب من',
  SUPPORT: '🆘 پشتیبانی',
  MY_CONFIGS: '📡 کانفیگ های من',
  GIFT_CODE: '🎁 کد هدیه',  // Add this line
  TRUST: '🤝 رضایت مشتری و اموزش',
  COOPERATION: '💵 همکاری در فروش'
} as const;

export class BotService {

  private bot: Telegraf;
  private adminChatIds: number[];

  private pendingServicePurchase = new Map<number, { serviceId: number; isTest: boolean }>();
  private pendingGiftCode = new Set<number>();   // ← add
  private pendingPayment = new Set<number>();    // ← add
  private pendingReferral = new Map<number, { step: string }>();
  private pendingWithdrawalReceipt = new Map<number, number>(); // adminTelegramId -> withdrawalId
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


  private setupCommands() {
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    this.bot.command('buy', (ctx) => this.handleBuyService(ctx));
    this.bot.command('my_services', (ctx) => this.handleMyServices(ctx));
    this.bot.command('add_funds', (ctx) => this.handleAddFunds(ctx));
    this.bot.command('my_configs', (ctx) => this.handleMyConfigs(ctx));
    this.bot.command('my_account', (ctx) => this.handleMyAccount(ctx));
    this.bot.command('support', (ctx) => this.handleSupport(ctx));
    this.bot.command('how_to_use', (ctx) => this.handleHowToUse(ctx));
    this.bot.command('test_config', (ctx) => this.handleTestConfig(ctx)); // ✅ Fixed: changed from 'test_service' to 'test_config'
    this.bot.command('gift', (ctx) => this.handleGiftCode(ctx)); // Also add as command
    this.bot.command('trust', (ctx) => this.handleTrust(ctx));
    this.bot.hears(PERSIAN_BUTTONS.COOPERATION, (ctx) => this.handleCooperation(ctx));



    // Map Persian text to handlers
    this.bot.hears(PERSIAN_BUTTONS.BUY, (ctx) => this.handleBuyService(ctx));
    this.bot.hears(PERSIAN_BUTTONS.MY_SERVICES, (ctx) => this.handleMyServices(ctx));
    this.bot.hears(PERSIAN_BUTTONS.TEST_CONFIG, (ctx) => this.handleTestConfig(ctx));
    this.bot.hears(PERSIAN_BUTTONS.ADD_FUNDS, (ctx) => this.handleAddFunds(ctx));
    this.bot.hears(PERSIAN_BUTTONS.MY_ACCOUNT, (ctx) => this.handleMyAccount(ctx));
    this.bot.hears(PERSIAN_BUTTONS.SUPPORT, (ctx) => this.handleSupport(ctx));
    this.bot.hears(PERSIAN_BUTTONS.MY_CONFIGS, (ctx) => this.handleMyConfigs(ctx));
    this.bot.hears(PERSIAN_BUTTONS.GIFT_CODE, (ctx) => this.handleGiftCode(ctx));
    this.bot.hears(PERSIAN_BUTTONS.TRUST, (ctx) => this.handleTrust(ctx));


  }



  private setupCallbacks() {

    // Refferal Callbacks:
    this.bot.action('referral_confirm_register', async (ctx) => {
      try {
        const user = await db.getUserByTelegramId(ctx.from!.id);
        const pending = this.pendingReferral.get(user.telegram_id) as any;
        if (!pending) { await ctx.answerCbQuery('❌ خطا'); return; }

        await db.createReferralProfile(user.id, pending.cardNumber, pending.cardOwner);
        this.pendingReferral.delete(user.telegram_id);

        const referralLink = `https://t.me/V2chainbot?start=ref_${user.telegram_id}`;
        const message =
          `🎉 ثبت‌نام در سیستم همکاری در فروش با موفقیت انجام شد!\n\n` +
          `🔗 لینک معرفی شما:\n${referralLink}\n\n` +
          `این لینک را با دوستان خود به اشتراک بگذارید.`;

        await ctx.answerCbQuery('✅ ثبت‌نام موفق');
        await ctx.editMessageText(this.escapeMarkdown(message), { parse_mode: 'MarkdownV2' });
      } catch (error: any) {
        console.error('Error confirming referral register:', error);
        await ctx.answerCbQuery('❌ خطا در ثبت‌نام');
      }
    });

    this.bot.action('referral_cancel', async (ctx) => {
      const user = await db.getUserByTelegramId(ctx.from!.id);
      this.pendingReferral.delete(user.telegram_id);
      await ctx.answerCbQuery('❌ لغو شد');
      await ctx.deleteMessage();
    });

    this.bot.action('referral_edit_card', async (ctx) => {
      const user = await db.getUserByTelegramId(ctx.from!.id);
      this.pendingReferral.set(user.telegram_id, { step: 'edit_card_number' } as any);
      await ctx.answerCbQuery();
      await ctx.editMessageText('✏️ شماره کارت جدید خود را وارد کنید:');
    });

    this.bot.action('referral_stats', async (ctx) => {
      try {
        const user = await db.getUserByTelegramId(ctx.from!.id);
        const stats = await db.getReferralStats(user.id);
        await ctx.answerCbQuery();
        const message =
          `📊 آمار تفصیلی همکاری در فروش\n\n` +
          `👥 تعداد زیرمجموعه: ${stats?.total_referrals || 0} نفر\n` +
          `💰 کل درآمد: ${Math.floor(stats?.total_earned || 0)} تومان\n` +
          `💸 برداشت شده: ${Math.floor(stats?.total_withdrawn || 0)} تومان\n` +
          `💳 موجودی قابل برداشت: ${Math.floor(stats?.pending_balance || 0)} تومان`;

        await ctx.editMessageText(this.escapeMarkdown(message), {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('🔙 بازگشت', 'referral_back_dashboard')]
            ]
          }
        });
      } catch (error: any) {
        await ctx.answerCbQuery('❌ خطا');
      }
    });

    this.bot.action('referral_withdraw', async (ctx) => {
      try {
        const user = await db.getUserByTelegramId(ctx.from!.id);
        const profile = await db.getReferralProfile(user.id);
        const settings = await db.getReferralSettings();
        if (!profile) {

          await ctx.sendMessage(
            `❌ پنل همکاری وجود ندارد`,
            { parse_mode: 'MarkdownV2' }
          );
          return;
        }

        if (profile.pending_balance < settings.min_withdrawal_amount) {
          await ctx.answerCbQuery(`❌ حداقل مبلغ برداشت ${Math.floor(settings.min_withdrawal_amount)} تومان است`);
          return;
        }

        const withdrawal = await db.createWithdrawalRequest(
          user.id,
          profile.pending_balance,
          profile.card_number,
          profile.card_owner_name
        );

        // Deduct from pending balance
        await db.updateReferralProfile(user.id, {
          pending_balance: 0,
          total_withdrawn: profile.total_withdrawn + profile.pending_balance
        });

        // Notify admins
        const adminMessage =
          `💸 درخواست برداشت جدید\n\n` +
          `👤 کاربر: @${user.username || user.telegram_id}\n` +
          `💰 مبلغ: ${Math.floor(withdrawal.amount)} تومان\n` +
          `💳 شماره کارت: ${withdrawal.card_number}\n` +
          `👤 نام صاحب کارت: ${withdrawal.card_owner_name}\n` +
          `🆔 شناسه درخواست: ${withdrawal.id}`;

        for (const adminId of this.adminChatIds) {
          const msg = await this.bot.telegram.sendMessage(adminId, this.escapeMarkdown(adminMessage), {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                Markup.button.callback('✅ تایید و ارسال رسید', `confirm_withdrawal_${withdrawal.id}`),
                Markup.button.callback('❌ رد درخواست', `decline_withdrawal_${withdrawal.id}`)
              ]]
            }
          });
          await db.updateWithdrawalRequest(withdrawal.id, {
            admin_message_id: msg.message_id,
            admin_chat_id: adminId
          });
        }

        await ctx.answerCbQuery('✅ درخواست ارسال شد');
        const confirmMessage =
          `✅ درخواست برداشت ثبت شد\n\n` +
          `💰 مبلغ: ${Math.floor(withdrawal.amount)} تومان\n` +
          `پس از تایید ادمین، مبلغ به کارت شما واریز خواهد شد.`;

        await ctx.editMessageText(this.escapeMarkdown(confirmMessage), { parse_mode: 'MarkdownV2' });
      } catch (error: any) {
        console.error('Error in referral_withdraw:', error);
        await ctx.answerCbQuery('❌ خطا در ثبت درخواست');
      }
    });

    this.bot.action('referral_back_dashboard', async (ctx) => {
      const user = await db.getUserByTelegramId(ctx.from!.id);
      const profile = await db.getReferralProfile(user.id);
      await ctx.answerCbQuery();
      await ctx.deleteMessage();
      await this.showReferralDashboard(ctx, user, profile);
    });

    this.bot.action(/^confirm_withdrawal_(\d+)$/, async (ctx) => {
      await this.handleConfirmWithdrawal(ctx);
    });

    this.bot.action(/^decline_withdrawal_(\d+)$/, async (ctx) => {
      await this.handleDeclineWithdrawal(ctx);
    });

    // other callbacks
    this.bot.action(/^myconf_(\d+)$/, async (ctx) => this.handleMyConfigDetail(ctx));
    this.bot.action(/^myconf_qr_(.+)$/, async (ctx) => this.handleMyConfigQR(ctx));
    this.bot.action('back_to_my_services', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.deleteMessage();
      await this.handleMyServices(ctx);
    });
    this.bot.action(/^service_(\d+)$/, async (ctx) => this.handleServiceSelect(ctx));
    this.bot.action(/^confirm_purchase_(\d+)$/, async (ctx) => this.handleConfirmPurchase(ctx));
    this.bot.action(/^cancel_purchase$/, async (ctx) => this.handleCancelPurchase(ctx));
    this.bot.action(/^payed_(\d+)$/, async (ctx) => this.handlePaymentMade(ctx));
    this.bot.action(/^cancel_payment_(\d+)$/, async (ctx) => this.handleCancelPayment(ctx));
    this.bot.action(/^confirm_payment_(\d+)$/, async (ctx) => this.handleAdminConfirmPayment(ctx));
    this.bot.action(/^decline_payment_(\d+)$/, async (ctx) => this.handleAdminDeclinePayment(ctx));
    this.bot.action(/^redeem_gift_(\d+)$/, async (ctx) => this.handleRedeemGift(ctx));
    this.bot.action('cancel_gift', async (ctx) => this.handleCancelGift(ctx));

    this.bot.on('photo', async (ctx) => this.handlePhoto(ctx));
    this.bot.on('text', async (ctx) => this.handleText(ctx));
  }

  // Handle Withdrawl Confirm and Declines:

  async handleConfirmWithdrawal(ctx: any) {
    try {
      const withdrawalId = parseInt(ctx.match[1]);
      const withdrawal = await db.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) { await ctx.answerCbQuery('❌ یافت نشد'); return; }
      if (withdrawal.status !== 'pending') { await ctx.answerCbQuery('⚠️ قبلاً پردازش شده'); return; }

      this.pendingWithdrawalReceipt.set(ctx.from.id, withdrawalId);
      await ctx.answerCbQuery();
      await ctx.reply('📸 لطفاً تصویر رسید پرداخت را ارسال کنید:');
    } catch (error: any) {
      await ctx.answerCbQuery('❌ خطا');
    }
  }

  async handleDeclineWithdrawal(ctx: any) {
    try {
      const withdrawalId = parseInt(ctx.match[1]);
      const withdrawal = await db.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) { await ctx.answerCbQuery('❌ یافت نشد'); return; }
      if (withdrawal.status !== 'pending') { await ctx.answerCbQuery('⚠️ قبلاً پردازش شده'); return; }

      await db.updateWithdrawalRequest(withdrawalId, { status: 'declined' });

      // Refund pending balance
      const profile = await db.getReferralProfile(withdrawal.user_id);
      await db.updateReferralProfile(withdrawal.user_id, {
        pending_balance: withdrawal.amount,
        total_withdrawn: profile!.total_withdrawn - withdrawal.amount
      });

      const message =
        `❌ درخواست برداشت شما رد شد\n\n` +
        `💰 مبلغ ${Math.floor(withdrawal.amount)} تومان به موجودی شما بازگشت`;

      await this.bot.telegram.sendMessage(
        withdrawal.telegram_id,
        this.escapeMarkdown(message),
        { parse_mode: 'MarkdownV2' }
      );

      await ctx.answerCbQuery('❌ رد شد');
      await ctx.editMessageText((ctx.callbackQuery.message as any).text + '\n\n❌ رد شد', {
        reply_markup: { inline_keyboard: [] }
      });
    } catch (error: any) {
      await ctx.answerCbQuery('❌ خطا');
    }
  }

  // Handle Cooperation

  async handleCooperation(ctx: Context) {
    try {
      const user = await db.getUserByTelegramId(ctx.from!.id);
      const profile = await db.getReferralProfile(user.id);
      const settings = await db.getReferralSettings();

      if (!settings.is_enabled) {
        await ctx.reply('⚠️ سیستم همکاری در فروش در حال حاضر غیرفعال است', { parse_mode: 'Markdown' });
        return;
      }

      if (profile) {
        // Already registered — show dashboard
        await this.showReferralDashboard(ctx, user, profile);
        return;
      }

      // Not registered — show rules and onboarding
      const settings2 = await db.getReferralSettings();
      const message =
        `🤝 همکاری در فروش V2Chain\n\n` +
        `با معرفی دوستان خود به V2Chain، از هر خرید آن‌ها ${settings.commission_percent}٪ کمیسیون دریافت کنید!\n\n` +
        `📋 قوانین:\n` +
        `• کمیسیون هر خرید: ${settings.commission_percent}٪\n` +
        `• حداقل مبلغ برداشت: ${Math.floor(settings.min_withdrawal_amount)} تومان\n` +
        `• حداکثر تعداد زیرمجموعه: ${settings.max_referrals_per_user} نفر\n` +
        `• پرداخت کمیسیون پس از تایید ادمین\n\n` +
        `برای شروع، شماره کارت بانکی خود را وارد کنید:`;

      await ctx.reply(this.escapeMarkdown(message), { parse_mode: 'MarkdownV2' });
      this.pendingReferral.set(user.telegram_id, { step: 'card_number' });
    } catch (error: any) {
      console.error('Error in handleCooperation:', error);
      await ctx.reply('❌ خطایی رخ داد، لطفاً دوباره امتحان کنید');
    }
  }

  private async showReferralDashboard(ctx: Context, user: any, profile: any) {
    const stats = await db.getReferralStats(user.id);
    const referralLink = `https://t.me/V2chainbot?start=ref_${user.telegram_id}`;

    const message =
      `🤝 داشبورد همکاری در فروش\n\n` +
      `👥 زیرمجموعه‌ها: ${stats?.total_referrals || 0} نفر\n` +
      `💰 کل درآمد: ${Math.floor(profile.total_earned)} تومان\n` +
      `💸 برداشت شده: ${Math.floor(profile.total_withdrawn)} تومان\n` +
      `💳 موجودی قابل برداشت: ${Math.floor(profile.pending_balance)} تومان\n\n` +
      `🔗 لینک معرفی شما:\n${referralLink}`;

    await ctx.reply(this.escapeMarkdown(message), {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('✏️ ویرایش اطلاعات کارت', 'referral_edit_card')],
          [Markup.button.callback('💸 درخواست برداشت', 'referral_withdraw')],
          [Markup.button.callback('📊 آمار تفصیلی', 'referral_stats')]
        ]
      }
    });
  }

  async handleReferralTextInput(ctx: Context, user: any, text: string) {
    const pending = this.pendingReferral.get(user.telegram_id);
    if (!pending) return false;

    if (pending.step === 'card_number') {
      if (!/^\d{16}$/.test(text.replace(/-/g, ''))) {
        await ctx.reply('❌ شماره کارت نامعتبر است لطفاً 16 رقم کارت را وارد کنید:');
        return true;
      }
      this.pendingReferral.set(user.telegram_id, { step: 'card_owner', ...{ cardNumber: text.trim() } } as any);
      await ctx.reply('✅ شماره کارت ثبت شد \n\nحالا نام صاحب کارت را به فارسی وارد کنید:');
      return true;
    }

    if ((pending as any).step === 'card_owner') {
      const cardNumber = (pending as any).cardNumber;
      this.pendingReferral.set(user.telegram_id, {
        step: 'confirm',
        cardNumber,
        cardOwner: text.trim()
      } as any);

      await ctx.reply(
        `✅ اطلاعات شما:\n\n` +
        `💳 شماره کارت: ${cardNumber}\n` +
        `👤 نام صاحب کارت: ${text.trim()}\n\n` +
        `آیا با قوانین همکاری در فروش موافقید؟`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('✅ موافقم و ثبت‌نام می‌کنم', 'referral_confirm_register')],
              [Markup.button.callback('❌ انصراف', 'referral_cancel')]
            ]
          }
        }
      );
      return true;
    }

    if ((pending as any).step === 'edit_card_number') {
      if (!/^\d{16}$/.test(text.replace(/-/g, ''))) {
        await ctx.reply('❌ شماره کارت نامعتبر است:');
        return true;
      }
      this.pendingReferral.set(user.telegram_id, { step: 'edit_card_owner', cardNumber: text.trim() } as any);
      await ctx.reply('✅ شماره کارت جدید ثبت شد \n\nنام صاحب کارت را وارد کنید:');
      return true;
    }

    if ((pending as any).step === 'edit_card_owner') {
      const cardNumber = (pending as any).cardNumber;
      await db.updateReferralProfile(user.id, {
        card_number: cardNumber,
        card_owner_name: text.trim()
      });
      this.pendingReferral.delete(user.telegram_id);
      await ctx.reply('✅ اطلاعات کارت با موفقیت به‌روزرسانی شد');
      const profile = await db.getReferralProfile(user.id);
      await this.showReferralDashboard(ctx, user, profile);
      return true;
    }

    return false;
  }

  // Handle Bot Start

  async handleStart(ctx: Context) {

    const user = await db.getUserByTelegramId(ctx.from!.id);

    // Handle referral deep link
    const startPayload = (ctx.message as any)?.text?.split(' ')[1];
    if (startPayload?.startsWith('ref_')) {
      const referrerTelegramId = parseInt(startPayload.replace('ref_', ''));
      if (referrerTelegramId !== ctx.from!.id) {
        const referrer = await db.query(
          `SELECT * FROM users WHERE telegram_id = $1`,
          [referrerTelegramId]
        );
        if (referrer.rows[0]) {
          const settings = await db.getReferralSettings();
          const referralCount = await db.getReferralCount(referrer.rows[0].id);
          if (settings.is_enabled && referralCount < settings.max_referrals_per_user) {
            await db.createReferral(referrer.rows[0].id, user.id);
          }
        }
      }
    }

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
        [PERSIAN_BUTTONS.BUY, PERSIAN_BUTTONS.MY_SERVICES],
        [PERSIAN_BUTTONS.TEST_CONFIG, PERSIAN_BUTTONS.ADD_FUNDS],
        [PERSIAN_BUTTONS.MY_ACCOUNT, PERSIAN_BUTTONS.SUPPORT],
        [PERSIAN_BUTTONS.MY_CONFIGS, PERSIAN_BUTTONS.GIFT_CODE],
        [PERSIAN_BUTTONS.TRUST],
        [PERSIAN_BUTTONS.COOPERATION]

      ]).resize()
    });

  }


  // Handle Gift Code Oprtations

  async handleGiftCode(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    this.pendingGiftCode.add(user.telegram_id);  // ← add
    await ctx.reply(
      `🎁 *کد هدیه*\n\n` +
      `لطفاً کد هدیه خود را ارسال کنید:`,
      { parse_mode: 'Markdown' }
    );
  }


  async handleRedeemGift(ctx: any) {
    try {
      const giftCodeId = parseInt(ctx.match[1]);
      const user = await db.getUserByTelegramId(ctx.from!.id);

      await ctx.answerCbQuery('🔄 در حال اعمال کد');
      await ctx.editMessageText('🔄 در حال اعمال کد هدیه');

      // Redeem the code
      const result = await db.redeemGiftCode(giftCodeId, user.id);

      if (result.success) {
        const user = await db.getUserByTelegramId(ctx.from!.id); // Get updated user
        await ctx.editMessageText(
          `✅ *کد هدیه با موفقیت اعمال شد*\n\n` +
          `💰 مبلغ: +${Math.floor(result.amount!)} تومان\n` +
          `💳 موجودی جدید: ${Math.floor(user.balance)} تومان\n\n` +
          `از انتخاب ما سپاسگزاریم 🙏`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error('Error in handleRedeemGift:', error);
      await ctx.editMessageText('❌ خطا در اعمال کد هدیه', { parse_mode: 'Markdown' });
    }
  }

  async handleCancelGift(ctx: any) {
    await ctx.answerCbQuery('❌ عملیات لغو شد');
    await ctx.deleteMessage();
  }




  // Handle Service Purchase Operations
  async handleBuyService(ctx: Context) {

    const services = await db.getServices();

    if (services.length === 0) {
      await ctx.reply(BotMessages.noServicesAvailable(), { parse_mode: 'MarkdownV2' });
      return;
    }

    const serviceButtons = services.map(service =>
      [Markup.button.callback(
        `${service.description} - تومان${Math.floor(service.price)} - ${service.duration_days} روز`,
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
            Markup.button.callback('✅ تایید پرداخت', `confirm_purchase_${service.id}`),
            Markup.button.callback('❌ لغو', 'cancel_purchase')
          ]
        ]
      }
    });
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

    // try {
    // Create V2Ray service
    // const userEmail = `${user.telegram_id}@v2ray.${serviceId}.${Math.random().toString(8).substring(2)}`;
    // const params = {
    //   userId: user.id,
    //   userEmail: userEmail,
    //   serviceId: service.id,
    //   serviceName: service.name,
    //   durationDays: service.duration_days,
    //   dataLimitGB: service.data_limit_gb
    // };

    // const result = await v2rayServices.createService(params);
    this.pendingServicePurchase.set(user.telegram_id, { serviceId, isTest: false });


    await ctx.answerCbQuery();
    const message = BotMessages.serviceNamePrompt();
    await ctx.editMessageText(
      this.escapeMarkdown(message),
      { parse_mode: 'Markdown' }
    );

    //   if (!result.success) {
    //     throw new Error(result.message || 'Failed to create service');
    //   }

    //   // Deduct balance
    //   await db.updateUserBalance(user.id, -service.price);

    //   await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseSuccessful);

    //   // Send the main message with all links
    //   const message = BotMessages.purchaseSuccessful(service);
    //   await ctx.editMessageText(
    //     this.escapeMarkdown(message),
    //     { parse_mode: 'MarkdownV2' }
    //   );

    //   const subLinkMessage = BotMessages.subLinksMessage(userEmail);
    //   await ctx.sendMessage(
    //     this.escapeMarkdown(subLinkMessage),
    //     { parse_mode: 'MarkdownV2' }
    //   );

    //   const qrBuffer = await BotMessages.getQrBuffer(userEmail);

    //   // Send QR code as photo with caption
    //   await ctx.replyWithPhoto(
    //     { source: qrBuffer },
    //     {
    //       caption: 'می‌توانید QR کد را اسکن کنید تا لینک‌های خود را دریافت کنید'
    //     }
    //   );


    // } catch (error: any) {
    //   console.error('Error creating service:', error);
    //   await ctx.answerCbQuery('❌ Service creation failed');
    //   await ctx.editMessageText(
    //     `❌ خطا در ساخت سرویس: \n\nلطفا با پشتیبانی در تماس باشید`,
    //     { parse_mode: 'MarkdownV2' }
    //   );
    // }
  }


  async handleCancelPurchase(ctx: any) {
    await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseCancelled);
    await ctx.deleteMessage();
  }

  // Hanlde My Services Operation

  // async handleMyServices(ctx: Context) {
  //   const user = await db.getUserByTelegramId(ctx.from!.id);

  //   // Get user's services with accurate data usage from database
  //   const userServices = await db.getUserServices(user.id);

  //   if (userServices.length === 0) {
  //     await ctx.reply(BotMessages.noActiveConfigs(), { parse_mode: 'MarkdownV2' });
  //     return;
  //   }

  //   const messages = BotMessages.userServices(userServices);

  //   for (const message of messages) {
  //     await ctx.reply(
  //       this.escapeMarkdown(message),
  //       { parse_mode: 'MarkdownV2' }
  //     );
  //   }
  // }

  async handleMyServices(ctx: Context) {
    try {
      const user = await db.getUserByTelegramId(ctx.from!.id);
      const userServices = await db.getUserServices(user.id);

      if (userServices.length === 0) {
        await ctx.reply(BotMessages.noActiveConfigs(), { parse_mode: 'MarkdownV2' });
        return;
      }

      const buttons = userServices.map(service => [
        Markup.button.callback(
          `${service.config_name}`,
          `myconf_${service.config_id}`  // ← use config_id not service.id
        )
      ]);

      await ctx.reply('📋 *سرویس‌های من*\n\nیک سرویس را انتخاب کنید:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error: any) {
      console.error('Error in handleMyServices:', error);
      await ctx.reply('❌ خطا در دریافت سرویس‌ها');
    }
  }

  async handleMyConfigDetail(ctx: any) {
    try {
      const configId = parseInt(ctx.match[1]);
      const user = await db.getUserByTelegramId(ctx.from!.id);

      const result = await db.query(
        `SELECT * FROM user_configs WHERE id = $1 AND user_id = $2`,
        [configId, user.id]
      );

      if (result.rowCount === 0) {
        await ctx.answerCbQuery('❌ سرویس یافت نشد');
        return;
      }

      const config = result.rows[0];
      const dataUsed = parseFloat(config.data_used_gb || 0).toFixed(2);
      const dataLimit = config.data_limit_gb
        ? `${parseFloat(config.data_limit_gb).toFixed(2)} GB`
        : 'نامحدود';
      const remainingDays = Math.ceil(
        (new Date(config.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `📡 *${config.config_name}*\n\n` +
        `📊 مصرف: ${dataUsed} GB / ${dataLimit}\n` +
        `⏰ ${remainingDays} روز باقی مانده\n` +
        `📌 وضعیت: ${config.status}\n\n` +
        `🔗 لینک اشتراک:\n\`https://${process.env.SUB_DOMAIN}/links/${config.sub_id}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('📷 دریافت QR کد', `myconf_qr_${config.sub_id}`)],
              [Markup.button.callback('🔙 بازگشت', 'back_to_my_services')]
            ]
          }
        }
      );
    } catch (error: any) {
      console.error('Error in handleMyConfigDetail:', error);
      await ctx.answerCbQuery('❌ خطا در دریافت اطلاعات');
    }
  }

  async handleMyConfigQR(ctx: any) {
    try {
      const subId = ctx.match[1];
      await ctx.answerCbQuery('📷 در حال ساخت QR کد...');

      const qrBuffer = await BotMessages.getQrBuffer(
        `${subId}`
      );

      await ctx.replyWithPhoto(
        { source: qrBuffer },
        { caption: `🔗 لینک اشتراک برای اسکن` }
      );
    } catch (error: any) {
      console.error('Error in handleMyConfigQR:', error);
      await ctx.answerCbQuery('❌ خطا در ساخت QR کد');
    }
  }

  // Handle Test Config Operation

  async handleTestConfig(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);

    // Check if user already used test config
    const hasTest = await db.hasTestConfig(user.id);
    if (hasTest) {
      await ctx.reply(BotMessages.alreadyUsedTest(), { parse_mode: 'MarkdownV2' });
      return;
    }

    // try {
    //   await ctx.reply('🔄 در حال ساخت سرویس تست شما  ', { parse_mode: 'MarkdownV2' });

    //   const userEmail = `${user.telegram_id}@test.v2ray`;
    //   // Create test service parameters
    //   const params = {
    //     userId: user.id,
    //     userEmail: userEmail, // Special email suffix for test
    //     serviceId: 1111, // 1111 for test services
    //     serviceName: 'Free Test',
    //     durationDays: 1, // 24 hours
    //     dataLimitGB: 1 // 1GB limit (Xray supports this)
    //   };

    //   // Create test service using V2Ray service
    //   const result = await v2rayServices.createService(params);

    //   if (!result.success) {
    //     throw new Error(result.message || 'Failed to create test service');
    //   }

    //   // Update the status to 'test' instead of 'active'
    //   await db.query(
    //     `UPDATE user_configs 
    //    SET status = 'test', 
    //        data_limit_gb = 1.00,
    //        updated_at = NOW() 
    //    WHERE client_email = $1 AND status = 'active'`,
    //     [params.userEmail]
    //   );

    //   // Send success message with all platform links
    //   await ctx.reply(
    //     BotMessages.testConfigActivated(),
    //     { parse_mode: 'MarkdownV2' }
    //   );

    //   const subLinkMessage = BotMessages.subLinksMessage(userEmail);
    //   await ctx.sendMessage(
    //     this.escapeMarkdown(subLinkMessage),
    //     { parse_mode: 'MarkdownV2' }
    //   );

    //   const qrBuffer = await BotMessages.getQrBuffer(userEmail);

    //   // Send QR code as photo with caption
    //   await ctx.replyWithPhoto(
    //     { source: qrBuffer },
    //     {
    //       caption: 'می‌توانید QR کد را اسکن کنید تا لینک‌های خود را دریافت کنید'
    //     }
    //   );

    //   console.log(`✅ Test service created for user ${user.id} (${user.telegram_id})`);

    // } catch (error: any) {
    //   console.error('❌ Error creating test service:', error);
    //   await ctx.reply(
    //     `❌ خطا در ساخت سرویس \n\nلطفا با پشتیبانی در تماس باشید`,
    //     { parse_mode: 'MarkdownV2' }
    //   );
    // }
    this.pendingServicePurchase.set(user.telegram_id, { serviceId: 1111, isTest: true });
    const message = BotMessages.serviceNamePrompt();
    await ctx.reply(this.escapeMarkdown(message), { parse_mode: 'Markdown' });
  }

  // Handle My Configs Operation

  async handleMyConfigs(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const configs = await db.getUserConfigs(user.id);


    if (configs.length == 0) {
      await ctx.sendMessage(
        BotMessages.noActiveConfigs(),
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    const messages = BotMessages.userConfigs(configs, this.escapeMarkdown);

    for (const msg of messages) {
      await ctx.sendMessage(msg, { parse_mode: 'MarkdownV2' });
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

  // Handle Add Funds


  async handlePaymentMade(ctx: any) {
    const paymentId = parseInt(ctx.match[1]);

    await ctx.answerCbQuery(BotMessages.callbackAnswers.pleaseSendReceipt);
    await ctx.editMessageText(
      BotMessages.paymentMadePrompt(),
      { parse_mode: 'MarkdownV2' }
    );
  }

  async handlePhoto(ctx: Context) {
    // added for refferal:
    // Add at the top of handlePhoto
    const adminTelegramId = ctx.from!.id;
    if (this.adminChatIds.includes(adminTelegramId) && this.pendingWithdrawalReceipt.has(adminTelegramId)) {
      const withdrawalId = this.pendingWithdrawalReceipt.get(adminTelegramId)!;
      this.pendingWithdrawalReceipt.delete(adminTelegramId);

      const withdrawal = await db.getWithdrawalRequest(withdrawalId);
      const photoFileId = (ctx.message as any).photo.slice(-1)[0].file_id;

      if (!withdrawal) {
        await ctx.sendMessage(
          'withdrawal does not exist',
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      await db.updateWithdrawalRequest(withdrawalId, {
        status: 'confirmed',
        receipt_photo: photoFileId,
        confirmed_at: new Date()
      });

      // Send receipt to user
      const message =
        `✅ پرداخت تایید شد\n\n` +
        `💰 مبلغ ${Math.floor(withdrawal.amount)} تومان به کارت شما واریز شد`;

      await this.bot.telegram.sendPhoto(withdrawal.telegram_id, photoFileId, {
        caption: this.escapeMarkdown(message),
        parse_mode: 'MarkdownV2'
      });

      await ctx.reply('✅ رسید ارسال شد و درخواست تایید شد');
      return;
    }

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
                  Markup.button.callback('✅ تایید پرداخت', `confirm_payment_${payment.id}`),
                  Markup.button.callback('❌ لغو پرداخت', `decline_payment_${payment.id}`)
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


    if (payment.status == 'confirmed') {

      this.adminChatIds.forEach(async (id) => {
        await this.bot.telegram.sendMessage(
          id,
          BotMessages.paymentAlreadyConfirmed(),
          { parse_mode: 'MarkdownV2' }
        );
      });

      return;
    }

    if (payment.status == 'declined') {

      this.adminChatIds.forEach(async (id) => {
        await this.bot.telegram.sendMessage(
          id,
          BotMessages.paymentAlreadyDecliened(),
          { parse_mode: 'MarkdownV2' }
        );
      });

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


    if (payment.status == 'confirmed') {

      this.adminChatIds.forEach(async (id) => {
        await this.bot.telegram.sendMessage(
          id,
          BotMessages.paymentAlreadyConfirmed(),
          { parse_mode: 'MarkdownV2' }
        );
      });

      return;
    }

    if (payment.status == 'declined') {

      this.adminChatIds.forEach(async (id) => {
        await this.bot.telegram.sendMessage(
          id,
          BotMessages.paymentAlreadyDecliened(),
          { parse_mode: 'MarkdownV2' }
        );
      });

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


  async handleAddFunds(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    this.pendingPayment.add(user.telegram_id);  // ← add

    await ctx.reply(BotMessages.addFundsPrompt(), { parse_mode: 'MarkdownV2' });
  }

  // Handle Text Input
  // async handleText(ctx: Context) {
  //   const text = (ctx.message as any).text;
  //   const user = await db.getUserByTelegramId(ctx.from!.id);


  //   const giftCodePattern = /^GIFT[-]?[A-Z0-9]{4,20}$/i;

  //   if (giftCodePattern.test(text.trim())) {
  //     const code = text.trim().toUpperCase();

  //     // Send processing message
  //     const processingMsg = await ctx.reply('🔄 در حال بررسی کد هدیه...');

  //     // Validate the code
  //     const validation = await db.validateGiftCode(code, user.id);

  //     if (!validation.valid) {
  //       await ctx.telegram.editMessageText(
  //         ctx.chat!.id,
  //         processingMsg.message_id,
  //         undefined,
  //         validation.message,
  //         { parse_mode: 'Markdown' }
  //       );
  //       return;
  //     }

  //     console.log("🎁🎁🎁Gift code valied🎁🎁🎁")

  //     // Ask for confirmation
  //     await ctx.telegram.editMessageText(
  //       ctx.chat!.id,
  //       processingMsg.message_id,
  //       undefined,
  //       `🎁 *کد هدیه معتبر*\n\n` +
  //       `مبلغ: ${Math.floor(validation.amount!)} تومان\n\n` +
  //       `آیا مایل به اعمال این کد هستید؟`,
  //       {
  //         parse_mode: 'Markdown',
  //         reply_markup: {
  //           inline_keyboard: [
  //             [
  //               Markup.button.callback('✅ بله', `redeem_gift_${validation.codeId}`),
  //               Markup.button.callback('❌ خیر', 'cancel_gift')
  //             ]
  //           ]
  //         }
  //       }
  //     );
  //     return;
  //   }


  //   // Check if user is in payment process
  //   if (!isNaN(parseFloat(text)) && parseFloat(text) > 0) {
  //     const amount = parseFloat(text);
  //     const cardNumber = process.env.PAYMENT_CARD_NUMBER || '1234-5678-9012-3456';
  //     const cardOwner = process.env.CARD_OWNER || "alex";
  //     const payment = await db.createPayment(user.id, amount, cardNumber);

  //     const message = BotMessages.paymentInvoice(payment, amount, cardOwner);

  //     await ctx.reply(message, {
  //       parse_mode: 'MarkdownV2',
  //       reply_markup: {
  //         inline_keyboard: [
  //           [
  //             Markup.button.callback('✅ پرداخت کردم ', `payed_${payment.id}`),
  //             Markup.button.callback('❌ لغو پرداخت', `cancel_payment_${payment.id}`)
  //           ]
  //         ]
  //       }
  //     });
  //   }
  // }
  // async handleText(ctx: Context) {
  //   const text = (ctx.message as any).text;
  //   const user = await db.getUserByTelegramId(ctx.from!.id);

  //   const pending = this.pendingServicePurchase.get(user.telegram_id);
  //   if (pending) {
  //     await this.handleServiceNameInput(ctx, user, text, pending);
  //     return;
  //   }

  //   const giftCodePattern = /^GIFT[-]?[A-Z0-9]{4,20}$/i;
  //   if (giftCodePattern.test(text.trim())) {
  //     await this.handleGiftCodeInput(ctx, user, text);
  //     return;
  //   }

  //   if (!isNaN(parseFloat(text)) && parseFloat(text) > 0) {
  //     await this.handlePaymentAmountInput(ctx, user, text);
  //     return;
  //   }
  // }
  async handleText(ctx: Context) {
    const text = (ctx.message as any).text;
    const user = await db.getUserByTelegramId(ctx.from!.id);

    // 1. Handle pending service name input
    const pending = this.pendingServicePurchase.get(user.telegram_id);
    if (pending) {
      await this.handleServiceNameInput(ctx, user, text, pending);
      return;
    }

    // 2. Handle gift code only if user explicitly opened gift code flow
    const giftCodePattern = /^GIFT[-]?[A-Z0-9]{4,20}$/i;
    if (this.pendingGiftCode.has(user.telegram_id) && giftCodePattern.test(text.trim())) {
      await this.handleGiftCodeInput(ctx, user, text);
      return;
    }

    // 3. Handle payment amount only if user explicitly opened add funds flow
    if (this.pendingPayment.has(user.telegram_id) && !isNaN(parseFloat(text)) && parseFloat(text) > 0) {
      await this.handlePaymentAmountInput(ctx, user, text);
      return;
    }

    // 4. handle Refferal code
    const referralHandled = await this.handleReferralTextInput(ctx, user, text);
    if (referralHandled) return;

    // 5. Anything else — tell user to use keyboard
    await ctx.reply(
      '⌨️ لطفاً از دکمه‌های منو استفاده کنید',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [PERSIAN_BUTTONS.BUY, PERSIAN_BUTTONS.MY_SERVICES],
            [PERSIAN_BUTTONS.TEST_CONFIG, PERSIAN_BUTTONS.ADD_FUNDS],
            [PERSIAN_BUTTONS.MY_ACCOUNT, PERSIAN_BUTTONS.SUPPORT],
            [PERSIAN_BUTTONS.MY_CONFIGS, PERSIAN_BUTTONS.GIFT_CODE],
            [PERSIAN_BUTTONS.TRUST]
          ],
          resize_keyboard: true
        }
      }
    );
  }

  private async handleServiceNameInput(ctx: Context, user: any, text: string, pending: { serviceId: number; isTest: boolean }) {
    const nameRegex = /^[a-zA-Z0-9]+$/;
    if (!nameRegex.test(text.trim())) {
      const message = BotMessages.serviceNameInvalid();
      await ctx.reply(this.escapeMarkdown(message), { parse_mode: 'Markdown' });
      return;
    }

    const configName = text.trim().toLowerCase();
    this.pendingServicePurchase.delete(user.telegram_id);

    try {
      await ctx.reply('🔄 در حال ساخت سرویس...', { parse_mode: 'Markdown' });

      const userEmail = `${user.telegram_id}@v2ray.${pending.serviceId}.${Math.random().toString(8).substring(2)}`;
      const service = pending.isTest ? null : await db.getServiceById(pending.serviceId);

      const params = {
        userId: user.id,
        userEmail,
        configName,
        serviceId: pending.serviceId,
        serviceName: pending.isTest ? 'Free Test' : service.name,
        durationDays: pending.isTest ? 1 : service.duration_days,
        dataLimitGB: pending.isTest ? 1 : service.data_limit_gb
      };

      const result = await v2rayServices.createService(params);
      if (!result.success) throw new Error(result.message);

      if (pending.isTest) {
        await db.query(
          `UPDATE user_configs SET status = 'test', data_limit_gb = 1.00, updated_at = NOW()
         WHERE client_email = $1 AND status = 'active'`,
          [userEmail]
        );

        await db.query(
          `UPDATE users
     SET has_test = true, updated_at = NOW()
     WHERE id = (
       SELECT user_id 
       FROM user_configs 
       WHERE client_email = $1
       LIMIT 1
     )`,
          [userEmail]
        );


        await ctx.reply(BotMessages.testConfigActivated(), { parse_mode: 'MarkdownV2' });
      } else {
        await db.updateUserBalance(user.id, -service.price);

        // handle refferal codes
        const referral = await db.getReferralByReferredId(user.id);
        if (referral) {
          const settings = await db.getReferralSettings();
          if (settings.is_enabled) {
            const commission = (service.price * settings.commission_percent) / 100;
            await db.addReferralCommission(referral.referrer_id, commission);
            // Notify referrer
            const commissionMessage =
              `💰 کمیسیون جدید\n\n` +
              `${Math.floor(commission)} تومان به موجودی همکاری شما اضافه شد!`;

            await this.bot.telegram.sendMessage(
              referral.referrer_telegram_id,
              this.escapeMarkdown(commissionMessage),
              { parse_mode: 'MarkdownV2' }
            );
          }
        }
        await ctx.reply(this.escapeMarkdown(BotMessages.purchaseSuccessful(service)), { parse_mode: 'MarkdownV2' });
      }
      // const subId = configName + crypto.randomBytes(4).toString('hex');
      const configResult = await db.query(
        `SELECT sub_id FROM user_configs WHERE client_email = $1`,
        [userEmail]
      );
      const subId = configResult.rows[0].sub_id;
      const subLinkMessage = BotMessages.subLinksMessage(subId);
      await ctx.sendMessage(this.escapeMarkdown(subLinkMessage), { parse_mode: 'MarkdownV2' });

      const qrBuffer = await BotMessages.getQrBuffer(subId);
      await ctx.replyWithPhoto(
        { source: qrBuffer },
        { caption: 'می‌توانید QR کد را اسکن کنید تا لینک‌های خود را دریافت کنید' }
      );

    } catch (error: any) {
      console.error('Error creating service:', error);
      await ctx.reply('❌ خطا در ساخت سرویس، لطفا با پشتیبانی در تماس باشید');
    }
  }

  private async handleGiftCodeInput(ctx: Context, user: any, text: string) {
    this.pendingGiftCode.delete(user.telegram_id);  // ← add at top
    const code = text.trim().toUpperCase();
    const processingMsg = await ctx.reply('🔄 در حال بررسی کد هدیه...');
    const validation = await db.validateGiftCode(code, user.id);

    if (!validation.valid) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        validation.message,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    console.log("🎁🎁🎁Gift code valid🎁🎁🎁");

    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      undefined,
      `🎁 *کد هدیه معتبر*\n\n` +
      `مبلغ: ${Math.floor(validation.amount!)} تومان\n\n` +
      `آیا مایل به اعمال این کد هستید؟`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback('✅ بله', `redeem_gift_${validation.codeId}`),
            Markup.button.callback('❌ خیر', 'cancel_gift')
          ]]
        }
      }
    );
  }

  private async handlePaymentAmountInput(ctx: Context, user: any, text: string) {
    this.pendingPayment.delete(user.telegram_id);  // ← add at top
    const amount = parseFloat(text);
    const cardNumber = process.env.PAYMENT_CARD_NUMBER || '1234-5678-9012-3456';
    const cardOwner = process.env.CARD_OWNER || 'alex';
    const payment = await db.createPayment(user.id, amount, cardNumber);
    const message = BotMessages.paymentInvoice(payment, amount, cardOwner);

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          Markup.button.callback('✅ پرداخت کردم', `payed_${payment.id}`),
          Markup.button.callback('❌ لغو پرداخت', `cancel_payment_${payment.id}`)
        ]]
      }
    });
  }

  // Handle Trust Operations
  async handleTrust(ctx: any) {
    const rawMessage = BotMessages.TrustMessage();
    const escaped = this.escapeMarkdown(rawMessage);

    await ctx.sendMessage(
      `*${escaped}*`,
      { parse_mode: 'MarkdownV2' }
    );
  }

  // Handle My Accounts Operation
  async handleMyAccount(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const configs = await db.getUserConfigs(user.id);

    const message = BotMessages.accountInformation(user, configs.length);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  }

  // Handle Support Operations
  async handleSupport(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const message = BotMessages.supportMessage(user.telegram_id);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  }

  // Handle How to use Operations
  async handleHowToUse(ctx: Context) {
    const channelLink = process.env.TUTORIAL_CHANNEL || 'https://t.me/v2chain_channel';
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

  // Start Bot
  launch() {
    this.bot.launch();
    console.log('🤖 Bot started successfully');

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}
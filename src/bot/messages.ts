import { UserConfig } from "../database/models/config.model";
import { Payment } from "../database/models/payment.model";
import { Service } from "../database/models/service.model";
import { VlessLinkGenerator, VlessLinkSet } from "../types/v2ray.links";
import format from 'telegram-format';
import QRCode from "qrcode";

export class BotMessages {
  // Helper method to escape MarkdownV2 special characters
  static escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  // Welcome message for /start command
  static welcomeMessage(user: any): string {
    const balance = Math.floor(user.balance);
    const username = user.username ? `${this.escapeMarkdown(user.username)}` : 'N/A';

    return `🎁 *قبل از خرید کانفیگ، اکانت تست رایگان دریافت کنید*`;
  }

  static TrustMessage(): string {
    return `✨ رضایت و اعتماد کاربران ما رو ببینید 👇
📚 همراه با آموزش استفاده از کانفیگ‌ها داخل کانال

🚀 همین حالا عضو شوید:
@v2chain_channel`;
  }


  static paymentAlreadyConfirmed() {
    return `⚠️ Payment Already Confirmed ⚠️`;
  }


  static paymentAlreadyDecliened() {
    return `⚠️ Payment Already Decliend ⚠️`;
  }

  // No services available
  static noServicesAvailable(): string {
    return `⚠️ در حال حاضر سرویسی موجود نیست\\.`;
  }

  // Available services list
  // add OFF prices to the menu message
  static availableServices(): string {
    return `📋 *Available Services:*`;
  }

  // Service details
  static serviceDetails(service: Service): string {
    const dataLimit = Math.floor(service.data_limit_gb);
    `${service.data_limit_gb} GB`
    return `📦 *جزئیات سرویس:*

*نام سرویس:* ${this.escapeMarkdown(service.name)}
*قیمت:* \\تومان${Math.floor(service.price)}
*مدت اعتبار:* ${service.duration_days} روز
*حجم ترافیک:* ${dataLimit}
*توضیحات:* ${this.escapeMarkdown(service.description)}

🛒 *آیا مایل به ادامه خرید هستید؟*`;

  }

  // Insufficient funds
  static insufficientFunds(userBalance: number, servicePrice: number): string {
    const balance = Math.floor(userBalance);
    return `⚠️ *موجودی شما کافی نیست\\!*

💰 *موجودی فعلی:* \\$${balance}
💳 *مبلغ مورد نیاز:* \\$${Math.floor(servicePrice)}

برای افزایش موجودی از کیبورد زیر استفاده کنید\\.`;

  }

  // Purchase successful
  //   static purchaseSuccessful(service: any, vlessLink: string): string {
  //     return `🎉 *Purchase Successful\\!*

  // *Service:* ${this.escapeMarkdown(service.name)}
  // *Expires:* In ${service.duration_days} days

  // *Your V2Ray Config:*
  // \`${vlessLink}\`

  // 📋 Use /my\\_services to view all your configs\\.`;
  //   }

  // No active configs
  static noActiveConfigs(): string {
    return `📭 *شما هیچ کانفیگ فعالی ندارید\\.*

🛒 برای خرید سرویس از کیبورد زیر استفاده کنید  
🎁 یا برای دریافت تست رایگان از کیبورد زیر استفاده کنید\\.`;

  }

  // User configs list
  // static userConfigs(configs: UserConfig[]): string {
  //   let message = `📋 *سرویس‌های فعال شما:*\n\n`;

  //   const escapeMarkdown = (text: string) => {
  //     return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
  //   };

  //   configs.forEach((config, index) => {
  //     const expiresDate = new Date(config.expires_at).toLocaleDateString();
  //     const remainingDays = Math.ceil(
  //       (new Date(config.expires_at).getTime() - Date.now()) /
  //       (1000 * 60 * 60 * 24)
  //     );
  //     const dataUsed = Math.floor(config.data_used_gb);

  //     message += `${index + 1}\\. *${config.service_id}*\n`;
  //     message += `   🔹 *وضعیت:* ${escapeMarkdown(config.status)}\n`;
  //     message += `   📅 *تاریخ انقضا:* ${escapeMarkdown(expiresDate)} \\(${remainingDays} روز باقی\\-مانده\\)\n`;
  //     message += `   📊 *میزان مصرف:* ${dataUsed} گیگابایت\n`;
  //     message += `   🔗 *لینک اتصال:* \`${escapeMarkdown(config.vless_link)}\`\n\n`;
  //   });

  //   return message;
  // }

  // static userConfigs(configs: UserConfig[]): string {
  //   let message = `📋 *سرویس‌های فعال شما:*\n\n`;

  //   const escapeMarkdown = (text: string) => {
  //     return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
  //   };

  //   configs.forEach((config, index) => {
  //     const expiresDate = new Date(config.expires_at).toLocaleDateString();
  //     const remainingDays = Math.ceil(
  //       (new Date(config.expires_at).getTime() - Date.now()) /
  //       (1000 * 60 * 60 * 24)
  //     );
  //     const dataUsed = Math.floor(config.data_used_gb);

  //     // Split the comma-separated vless_link string into an array
  //     const vlessLinks = config.vless_link.split(',');
  //     const platforms = ['Android', 'iOS', 'Windows', 'Linux', 'macOS','Standard'];

  //     // Start building the message for each config
  //     message += `${index + 1}\\. *${config.service_id}*\n`;
  //     message += `   🔹 *وضعیت:* ${escapeMarkdown(config.status)}\n`;
  //     message += `   📅 *تاریخ انقضا:* ${escapeMarkdown(expiresDate)} \\(${remainingDays} روز باقی\\-مانده\\)\n`;
  //     message += `   📊 *میزان مصرف:* ${dataUsed} گیگابایت\n`;

  //     // Add each vless link to the message
  //     message += `   🔗 *لینک اتصال:*\n`;
  //     vlessLinks.forEach((link, linkIndex) => {
  //       message += `\n${platforms[linkIndex]}\n \`${escapeMarkdown(link.trim())}\`\n`;
  //     });

  //     message += `\n`; // Add a blank line between configs
  //   });

  //   return message;
  // }
  // static userConfigs(configs: UserConfig[]): string[] {
  //   const messages: string[] = [];

  //   configs.forEach((config) => {
  //     let message = `📋 سرویس فعال شما\n\n`;

  //     const expiresDate = new Date(config.expires_at).toLocaleDateString();
  //     const remainingDays = Math.ceil(
  //       (new Date(config.expires_at).getTime() - Date.now()) /
  //       (1000 * 60 * 60 * 24)
  //     );

  //     const dataUsed = Math.floor(config.data_used_gb || 0);

  //     const vlessLinks = config.vless_link
  //       ? config.vless_link.split(',')
  //       : [];

  //     const platforms = ['Android', 'iOS', 'Windows', 'Linux', 'macOS', 'Standard'];

  //     message += `شناسه سرویس: ${config.service_id}\n`;
  //     message += `وضعیت: ${config.status}\n`;
  //     message += `تاریخ انقضا: ${expiresDate} (${remainingDays} روز باقی‌مانده)\n`;
  //     message += `میزان مصرف: ${dataUsed} گیگابایت\n\n`;

  //     message += `لینک‌های اتصال:\n`;

  //     vlessLinks.forEach((link, linkIndex) => {
  //       const platform = platforms[linkIndex] || `Link ${linkIndex + 1}`;
  //       message += `\n${platform}\n${link.trim()}\n`;
  //     });

  //     messages.push(message.trim());
  //   });

  //   return messages;
  // }

  static userConfigs(
    configs: UserConfig[],
    escapeMarkdown: (text: string) => string
  ): string[] {
    const messages: string[] = [];

    configs.forEach((config) => {
      let message = `📋 سرویس فعال شما\n\n`;

      const expiresDate = new Date(config.expires_at).toLocaleDateString();
      const remainingDays = Math.ceil(
        (new Date(config.expires_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
      );

      const dataUsed = Math.floor(config.data_used_gb || 0);

      const vlessLinks = config.vless_link
        ? config.vless_link.split(',')
        : [];

      const platforms = ['Android', 'iOS', 'Windows', 'Linux', 'macOS', 'Standard'];

      message += `شناسه سرویس: ${escapeMarkdown(String(config.service_id))}\n`;
      message += `وضعیت: ${escapeMarkdown(config.status)}\n`;
      message += `تاریخ انقضا: ${escapeMarkdown(expiresDate)} ${remainingDays} روز باقی‌مانده\n`;
      message += `میزان مصرف: ${escapeMarkdown(dataUsed.toString())} گیگابایت\n\n`;

      message += `لینک‌های اتصال:\n`;

      vlessLinks.forEach((link, linkIndex) => {
        const platform = platforms[linkIndex] || `Link ${linkIndex + 1}`;

        const safePlatform = escapeMarkdown(platform);
        const safeLink = escapeMarkdown(link.trim());

        message += `\n${safePlatform}\n\`${safeLink}\`\n`;
      });

      messages.push(message.trim());
    });

    return messages;
  }



  // Already used test config
  static alreadyUsedTest(): string {
    return `⚠️ *شما قبلاً از اکانت تست رایگان خود استفاده کرده‌اید\\.*`;
  }

  // Test config activated
  static testConfigActivated(): string {
    return `🎉 *اکانت تست رایگان فعال شد\\!*

⏳ این اکانت تست تا 24 ساعت دیگر منقضی می‌شود\\.

💡 برای خرید سرویس کامل از کیبورد استفاده کنید\\.`;

  }

  // Add funds prompt
  static addFundsPrompt(): string {
    return `💵 *چه مقدار می‌خواهید به موجودی خود اضافه کنید؟*

لطفاً مبلغ را به تومان وارد کنید \\(برای مثال 50000\\)\\:`;

  }

  // Payment invoice
  static paymentInvoice(payment: any, amount: number, cardOwner: string): string {
    const formattedAmount = Math.floor(amount);

    return `💰 *صورتحساب پرداخت* \\#${this.escapeMarkdown(payment.invoice_number)}

💵 *مبلغ:* \\${formattedAmount}
💳 *شماره کارت:* \u200E${payment.card_number}\u200E
👤 *صاحب حساب:* ${cardOwner}

لطفاً دقیقاً مبلغ \\${formattedAmount} را به شماره کارت بالا واریز کنید\\.  
سپس روی گزینه «پرداخت کردم» کلیک کرده و تصویر رسید را ارسال نمایید\\.`;

  }


  // Payment made prompt
  static paymentMadePrompt(): string {
    return `📸 *لطفاً تصویر رسید پرداخت را به صورت عکس ارسال کنید\\.*

پس از بررسی و تأیید رسید، پرداخت شما پردازش خواهد شد\\.`;

  }

  // No pending payment
  static noPendingPayment(): string {
    return `❌ *هیچ پرداخت در حال انتظاری یافت نشد\\.*

برای شروع فرآیند پرداخت از کیبورد استفاده کنید\\.`;
  }

  // Receipt received
  static receiptReceived(): string {
    return `✅ *رسید دریافت شد\\!*
ادمین‌ها مطلع شده‌اند\\. پرداخت شما به زودی پردازش خواهد شد\\.

📩 پس از تأیید، یک اعلان برای شما ارسال خواهد شد\\.`;

  }

  // Payment confirmed (user notification)
  static paymentConfirmedUser(amount: number): string {
    const formattedAmount = Math.floor(amount);
    return `✅ *پرداخت شما تأیید شد\\!*

💵 *مبلغ:* \\$${formattedAmount}

🙏 از  شما متشکریم\\!`;

  }

  // Payment confirmed (admin notification)
  static paymentConfirmedAdmin(payment: Payment): string {
    const username = payment.user_id;
    return `✅ *پرداخت* \\#${this.escapeMarkdown(payment.invoice_number)} *تأیید شد\\.*
👤 *کاربر:* ${username}
💵 *مبلغ:* \\$${Math.floor(payment.amount)}
✅ *وضعیت:* تأیید شده`;

  }

  // Payment declined (user notification)
  static paymentDeclinedUser(payment: any): string {
    return `❌ *پرداخت ناموفق بود*

فاکتور \\#${this.escapeMarkdown(payment.invoice_number)} رد شد\\.  

اگر فکر می‌کنید این یک خطا است، لطفاً با پشتیبانی تماس بگیرید\\.`;

  }

  // Payment declined (admin notification)
  static paymentDeclinedAdmin(payment: Payment): string {
    const username = payment.user_id;
    return `❌ *پرداخت* \\#${this.escapeMarkdown(payment.invoice_number)} *رد شد\\.*
👤 *کاربر:* ${username}
💵 *مبلغ:* \\$${Math.floor(payment.amount)}
❌ *وضعیت:* رد شده`;

  }

  // My account information
  static accountInformation(user: any, configsCount: number): string {
    const balance = Math.floor(user.balance);
    const username = user.username ? `${this.escapeMarkdown(user.username)}` : 'NOUSERNAME';
    const name = `${this.escapeMarkdown(user.first_name)} ${user.last_name ? this.escapeMarkdown(user.last_name) : ''}`.trim();
    const accountCreated = new Date(user.created_at).toLocaleDateString();
    const status = user.is_active ? 'فعال ✅' : 'غیر فعال ❌';

    return `👤 *اطلاعات حساب کاربری:*

👤 *نام کاربری:* ${username}
📅 *تاریخ ایجاد حساب:* ${this.escapeMarkdown(accountCreated)}

💰 *موجودی:* \\$${balance}
📡 *کانفیگ‌های فعال:* ${configsCount}
🔄 *وضعیت:* ${status}

`;

  }

  // Support message
  static supportMessage(telegramId: number): string {
    return `🛠️ *پشتیبانی*

اگر به کمک نیاز دارید، لطفاً مستقیماً با تیم پشتیبانی ما در ارتباط باشید\\.

🆔 *شناسه کاربری شما:* \`${telegramId}\`  
لطفاً این شناسه را هنگام تماس با پشتیبانی ذکر کنید\\.

📞 *ایدی* @${process.env.BOT_ADMIN_ID}`;


  }

  // How to use message
  static howToUse(channelLink: string): string {
    return `📚 *راهنمای استفاده*

برای آموزش‌ها و راهنمای استفاده از کانفیگ‌های V2Ray، لطفاً به کانال آموزشی ما بپیوندید\\.

*برای پیوستن اینجا کلیک کنید:* ${channelLink}`;

  }

  // Payment verification required (admin)
  // Payment verification required (admin)
  static paymentVerificationRequired(payment: any, user: any): string {
    const username = user.username ? this.escapeMarkdown(user.username) : 'N/A';

    return `💰 *تأیید پرداخت *

*فاکتور:* \\#${this.escapeMarkdown(payment.invoice_number)}
*کاربر:* ${username} \\(ID: ${user.telegram_id}\\)
*مبلغ:* \\$${Math.floor(payment.amount)}
*شماره کارت:* ${this.escapeMarkdown(payment.card_number)}`;

  }


  // Callback query answers
  static callbackAnswers = {
    serviceNotFound: 'Service not found',
    purchaseCancelled: 'Purchase cancelled',
    purchaseSuccessful: '✅ Purchase successful!',
    insufficientFunds: '❌ Insufficient funds! Please add funds first.',
    pleaseSendReceipt: 'Please send the receipt photo now',
    paymentNotFound: 'Payment not found',
    paymentConfirmed: 'Payment confirmed',
    paymentDeclined: 'Payment declined',
    paymentCancelled: 'Payment cancelled',
  };




  static purchaseSuccessful(service: any): string {
    return '\n\n' +
      `🎉 خرید با موفقیت انجام شد!\n\n` +
      `📦 سرویس: ${service.name}\n` +
      `⏳ انقضا: در ${service.duration_days} روز\n\n` +
      `📋 برای مشاهده همه کانفیگ‌های خود از سرویس های من استفاده کنید.`;
  }

  // Get platform-specific link
  static getPlatformLinkMessage(links: VlessLinkSet, platform: string): string {
    let platformLink = '';
    let platformName = '';

    switch (platform.toLowerCase()) {
      case 'android':
        platformLink = links.android;
        platformName = 'Android';
        break;
      case 'ios':
        platformLink = links.ios;
        platformName = 'iOS';
        break;
      case 'linux':
        platformLink = links.linux;
        platformName = 'Linux';
        break;
      case 'windows':
        platformLink = links.windows;
        platformName = 'Windows';
        break;
      case 'macos':
      case 'mac':
        platformLink = links.macos;
        platformName = 'macOS';
        break;
      default:
        platformLink = links.standard;
        platformName = 'Standard';
    }

    return `🔗 *${platformName} Configuration:*\n\n` +
      `\`${platformLink}\`\n\n`;
  }



  private static getStatusEmoji(status: string): string {
    switch (status) {
      case 'active': return '✅';
      case 'test': return '🧪';
      case 'suspended': return '⏸️';
      case 'expired': return '⏰';
      default: return '📋';
    }
  }




  // Helper method to make text bold in MarkdownV2
  static bold(text: string): string {
    return `*${this.escapeMarkdown(text)}*`;
  }

  // Helper method to make text monospace in MarkdownV2
  static monospace(text: string): string {
    return `\`${this.escapeMarkdown(text)}\``;
  }


  //   static userServices(services: any[]): string {
  //     if (services.length === 0) {
  //       return this.noActiveConfigs();
  //     }

  //    let message = `📋 *خلاصه سرویس‌های شما*\n\n`;

  // // Count by status
  // const activeCount = services.filter(s => s.status === 'active').length;
  // const testCount = services.filter(s => s.status === 'test').length;
  // const suspendedCount = services.filter(s => s.status === 'suspended').length;
  // const expiredCount = services.filter(s => s.status === 'expired').length;

  // const totalDataUsed = services.reduce((sum, s) => sum + parseFloat(s.data_used_gb || 0), 0);

  // message += `✅ ${this.bold('فعال:')} ${activeCount}\n`;
  // message += `🧪 ${this.bold('تست:')} ${testCount}\n`;
  // message += `⏸️ ${this.bold('معلق:')} ${suspendedCount}\n`;
  // message += `⏰ ${this.bold('منقضی شده:')} ${expiredCount}\n\n`;

  // message += `💾 ${this.bold('کل مصرف دیتا:')} ${this.escapeMarkdown(totalDataUsed.toFixed(2))} GB\n\n`;

  // // List active services only (for compact view)
  // const activeServices = services.filter(s => s.status === 'active' || s.status === 'test');
  // if (activeServices.length > 0) {
  //   message += `${this.bold('📡 سرویس‌های فعال:')}\n`;
  //   activeServices.forEach((service, index) => {
  //     const dataUsed = parseFloat(service.data_used_gb || 0).toFixed(2);
  //     const dataLimit = service.data_limit_gb 
  //       ? `${this.escapeMarkdown(service.data_limit_gb.toString())} GB` 
  //       : 'نامحدود';
  //     const remainingDays = Math.ceil(
  //       (new Date(service.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  //     );

  //     const serviceName = service.service_name || 'سرویس';
  //     message += `\n${index + 1}\\. ${this.bold(this.escapeMarkdown(serviceName))}\n`;
  //     message += `   📊 ${this.escapeMarkdown(dataUsed)} GB / ${dataLimit}\n`;
  //     message += `   ⏰ ${this.escapeMarkdown(remainingDays.toString())} روز باقی مانده\n`;
  //   });
  // }

  // message += '\n💡 برای مشاهده جزئیات کامل همه سرویس‌ها از سرویس های من استفاده کنید';

  //     return message;
  //   }

  // static userServices(services: any[]): string[]|string {
  //   if (services.length === 0) {
  //     return this.noActiveConfigs();
  //   }

  //   let message = `📋 خلاصه سرویس‌های شما\n\n`;

  //   // Count by status
  //   const activeCount = services.filter(s => s.status === 'active').length;
  //   const testCount = services.filter(s => s.status === 'test').length;
  //   const suspendedCount = services.filter(s => s.status === 'suspended').length;
  //   const expiredCount = services.filter(s => s.status === 'expired').length;

  //   const totalDataUsed = services.reduce(
  //     (sum, s) => sum + parseFloat(s.data_used_gb || 0),
  //     0
  //   );

  //   message += `✅ فعال: ${activeCount}\n`;
  //   message += `🧪 تست: ${testCount}\n`;
  //   message += `⏸️ معلق: ${suspendedCount}\n`;
  //   message += `⏰ منقضی شده: ${expiredCount}\n\n`;

  //   message += `💾 کل مصرف دیتا: ${totalDataUsed.toFixed(2)} GB\n\n`;

  //   // List active services only (for compact view)
  //   const activeServices = services.filter(
  //     s => s.status === 'active' || s.status === 'test'
  //   );

  //   if (activeServices.length > 0) {
  //     message += `📡 سرویس‌های فعال:\n`;

  //     activeServices.forEach((service, index) => {
  //       const dataUsed = parseFloat(service.data_used_gb || 0).toFixed(2);

  //       const dataLimit = service.data_limit_gb
  //         ? `${service.data_limit_gb.toString()} GB`
  //         : 'نامحدود';

  //       const remainingDays = Math.ceil(
  //         (new Date(service.expires_at).getTime() - Date.now()) /
  //           (1000 * 60 * 60 * 24)
  //       );

  //       const serviceName = service.service_name || 'سرویس';

  //       message += `\n${index + 1}. ${serviceName}\n`;
  //       message += `   📊 ${dataUsed} GB / ${dataLimit}\n`;
  //       message += `   ⏰ ${remainingDays} روز باقی مانده\n`;
  //     });
  //   }

  //   message +=
  //     '\n💡 برای مشاهده جزئیات کامل همه سرویس‌ها از سرویس های من استفاده کنید';

  //   return message;
  // }
  static userServices(services: any[]): string[] {
    if (services.length === 0) {
      return [this.noActiveConfigs()];
    }

    const messages: string[] = [];

    // ===== Summary Message =====
    const activeCount = services.filter(s => s.status === 'active').length;
    const testCount = services.filter(s => s.status === 'test').length;
    const suspendedCount = services.filter(s => s.status === 'suspended').length;
    const expiredCount = services.filter(s => s.status === 'expired').length;

    const totalDataUsed = services.reduce(
      (sum, s) => sum + parseFloat(s.data_used_gb || 0),
      0
    );

    let summary = `📋 خلاصه سرویس‌های شما\n\n`;
    summary += `✅ فعال: ${activeCount}\n`;
    summary += `🧪 تست: ${testCount}\n`;
    summary += `⏸️ معلق: ${suspendedCount}\n`;
    summary += `⏰ منقضی شده: ${expiredCount}\n\n`;
    summary += `💾 کل مصرف دیتا: ${totalDataUsed.toFixed(2)} GB`;

    messages.push(summary);

    // ===== Individual Service Messages =====
    services.forEach((service, index) => {
      const dataUsed = parseFloat(service.data_used_gb || 0).toFixed(2);

      const dataLimit = service.data_limit_gb
        ? `${service.data_limit_gb.toString()} GB`
        : 'نامحدود';

      const remainingDays = Math.ceil(
        (new Date(service.expires_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
      );

      const serviceName = service.service_name || 'سرویس';

      let serviceMessage = `📡 سرویس ${index + 1}\n\n`;
      serviceMessage += `🔹 نام: ${serviceName}\n`;
      serviceMessage += `📊 مصرف: ${dataUsed} GB / ${dataLimit}\n`;
      serviceMessage += `📅 وضعیت: ${service.status}\n`;
      serviceMessage += `⏰ ${remainingDays} روز باقی مانده\n`;

      if (service.client_email) {
        serviceMessage += `📧 کاربر: ${service.client_email}\n`;
      }

      messages.push(serviceMessage);
    });

    return messages;
  }

  // Detailed view with service IDs for support reference
  static userServicesDetailed(services: any[]): string {
    if (services.length === 0) {
      return this.noActiveConfigs();
    }

    let message = format.markdown.bold('📋 Detailed Service Information\n\n');

    services.forEach((service, index) => {
      const expiresDate = new Date(service.expires_at).toLocaleDateString();
      const createdDate = new Date(service.created_at).toLocaleDateString();
      const updatedDate = new Date(service.updated_at).toLocaleDateString();
      const calculatedDays = Math.ceil(
        (new Date(service.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const remainingDays = Math.max(0, calculatedDays);


      const dataUsed = parseFloat(service.data_used_gb || 0).toFixed(2);
      const dataLimit = service.data_limit_gb
        ? `${service.data_limit_gb} GB`
        : 'Unlimited';

      message += `${index + 1}. ${format.markdown.bold('Service Information')}\n`;
      message += `   ${format.markdown.bold('Service ID:')} ${service.config_id}\n`;
      message += `   ${format.markdown.bold('Name:')} ${service.service_name || 'N/A'}\n`;
      message += `   ${format.markdown.bold('Status:')} ${this.getStatusEmoji(service.status)} ${service.status}\n`;
      message += `   ${format.markdown.bold('Created:')} ${createdDate}\n`;
      message += `   ${format.markdown.bold('Last Updated:')} ${updatedDate}\n`;
      message += `   ${format.markdown.bold('Expires:')} ${expiresDate} (${remainingDays > 0 ? `${remainingDays} days left` : 'Expired'})\n`;
      message += `   ${format.markdown.bold('Data Used:')} ${dataUsed} GB / ${dataLimit}\n`;

      if (service.service_price) {
        message += `   ${format.markdown.bold('Original Price:')} $${service.service_price}\n`;
      }

      if (service.service_duration) {
        message += `   ${format.markdown.bold('Original Duration:')} ${service.service_duration} days\n`;
      }

      message += '\n';
    });

    message += format.markdown.bold('📝 Support Information:\n');
    message += 'Please provide the Service ID when contacting support for faster assistance\n';
    message += 'Use /support to contact our team';

    return message;
  }


  static subLinksMessage(subId: string) {
    return (
      `📡 اشتراک V2Ray شما آماده است\n\n` +
      `می‌توانید با استفاده از لینک زیر، اشتراک کانفیگ‌های خود را دریافت کنید.\n` +
      `کافی است این لینک را داخل برنامه V2Ray یا V2RayNG در بخش Subscription وارد (Import) کنید.\n\n` +
      `لینک اشتراک:\n` +
      `https://v2chain.links.gemminie.xyz/${subId}\n\n` +
      `پس از اضافه کردن لینک، برنامه را به‌روزرسانی (Update) کنید تا کانفیگ‌ها دریافت شوند.`
    );
  }

  static async getQrBuffer(subId: string): Promise<Buffer<ArrayBufferLike>> {
    const url = `https://v2chain.links.gemminie.xyz/links/${subId}`;
    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300,
      margin: 2
    });
    return qrBuffer;
  }



  static serviceNamePrompt(): string {
  return '✏️ *نام سرویس خود را انتخاب کنید*\n\nیک کلمه انگلیسی وارد کنید:\n(مثال: `myservice`)';
}

static serviceNameInvalid(): string {
  return '❌ نام باید فقط یک کلمه انگلیسی باشد، لطفاً دوباره امتحان کنید:';
}


}

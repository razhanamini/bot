// import { Telegraf, Context, Markup } from 'telegraf';
// import dotenv from 'dotenv';
// import db from '../database/database.service';

// dotenv.config();

// export class BotService {
//   private bot: Telegraf;
//   private adminChatIds: number[];

//   constructor() {
//     const token = process.env.BOT_TOKEN;
//     if (!token) {
//       throw new Error('BOT_TOKEN is not defined in environment variables');
//     }

//     this.bot = new Telegraf(token);
//     this.adminChatIds = process.env.ADMIN_CHAT_IDS?.split(',').map(id => parseInt(id)) || [];

//     this.setupMiddlewares();
//     this.setupCommands();
//     this.setupCallbacks();
//   }

//   private setupMiddlewares() {
//     this.bot.use(async (ctx, next) => {
//       if (ctx.from) {
//         await db.createUser(
//           ctx.from.id,
//           ctx.from.username || null,
//           ctx.from.first_name,
//           ctx.from.last_name || null
//         );
//       }
//       await next();
//     });
//   }

//   private setupCommands() {
//     this.bot.command('start', (ctx) => this.handleStart(ctx));
//     this.bot.command('buy', (ctx) => this.handleBuyService(ctx));
//     this.bot.command('my_services', (ctx) => this.handleMyServices(ctx));
//     this.bot.command('test_config', (ctx) => this.handleTestConfig(ctx));
//     this.bot.command('add_funds', (ctx) => this.handleAddFunds(ctx));
//     this.bot.command('my_account', (ctx) => this.handleMyAccount(ctx));
//     this.bot.command('support', (ctx) => this.handleSupport(ctx));
//     this.bot.command('how_to_use', (ctx) => this.handleHowToUse(ctx));
//   }

//   private setupCallbacks() {
//     this.bot.action(/^service_(\d+)$/, async (ctx) => this.handleServiceSelect(ctx));
//     this.bot.action(/^confirm_purchase_(\d+)$/, async (ctx) => this.handleConfirmPurchase(ctx));
//     this.bot.action(/^cancel_purchase$/, async (ctx) => this.handleCancelPurchase(ctx));
//     this.bot.action(/^payed_(\d+)$/, async (ctx) => this.handlePaymentMade(ctx));
//     this.bot.action(/^cancel_payment_(\d+)$/, async (ctx) => this.handleCancelPayment(ctx));
//     this.bot.action(/^confirm_payment_(\d+)$/, async (ctx) => this.handleAdminConfirmPayment(ctx));
//     this.bot.action(/^decline_payment_(\d+)$/, async (ctx) => this.handleAdminDeclinePayment(ctx));
    
//     this.bot.on('photo', async (ctx) => this.handlePhoto(ctx));
//     this.bot.on('text', async (ctx) => this.handleText(ctx));
//   }

//   async handleStart(ctx: Context) {
//     const user = await db.getUserByTelegramId(ctx.from!.id);
    
//     const welcomeMessage = `
// 🎉 Welcome to V2Ray Config Bot!

// 👤 User Information:
// ID: ${user.id}
// Username: @${user.username || 'N/A'}
// Balance: $${user.balance}

// Available Commands:
// /buy - Purchase V2Ray config
// /my_services - View your active configs
// /test_config - Get free test config
// /add_funds - Add funds to your account
// /my_account - View account details
// /support - Contact support
// /how_to_use - Tutorials and guides
//     `;

//     await ctx.reply(welcomeMessage, {
//       parse_mode: 'Markdown',
//       ...Markup.keyboard([
//         ['/buy', '/my_services'],
//         ['/test_config', '/add_funds'],
//         ['/my_account', '/support']
//       ]).resize()
//     });
//   }

//   async handleBuyService(ctx: Context) {
//     const services = await db.getServices();
    
//     if (services.length === 0) {
//       await ctx.reply('⚠️ No services available at the moment.');
//       return;
//     }

//     const serviceButtons = services.map(service => 
//       [Markup.button.callback(
//         `${service.name} - $${service.price} (${service.duration_days} days)`,
//         `service_${service.id}`
//       )]
//     );

//     await ctx.reply('📋 Available Services:', {
//       reply_markup: {
//         inline_keyboard: serviceButtons
//       }
//     });
//   }

//   async handleServiceSelect(ctx: any) {
//     const serviceId = parseInt(ctx.match[1]);
//     const service = await db.getServiceById(serviceId);
    
//     if (!service) {
//       await ctx.answerCbQuery('Service not found');
//       return;
//     }

//     const message = `
// 📦 Service Details:
// Name: ${service.name}
// Price: $${service.price}
// Duration: ${service.duration_days} days
// Data Limit: ${service.data_limit_gb ? `${service.data_limit_gb} GB` : 'Unlimited'}
// Description: ${service.description}

// Proceed with purchase?
//     `;

//     await ctx.editMessageText(message, {
//       parse_mode: 'Markdown',
//       reply_markup: {
//         inline_keyboard: [
//           [
//             Markup.button.callback('✅ Confirm Purchase', `confirm_purchase_${service.id}`),
//             Markup.button.callback('❌ Cancel', 'cancel_purchase')
//           ]
//         ]
//       }
//     });
//   }

//   async handleConfirmPurchase(ctx: any) {
//     const serviceId = parseInt(ctx.match[1]);
//     const service = await db.getServiceById(serviceId);
//     const user = await db.getUserByTelegramId(ctx.from.id);

//     if (user.balance < service.price) {
//       await ctx.answerCbQuery('❌ Insufficient funds! Please add funds first.');
//       await ctx.editMessageText(`⚠️ Insufficient balance!\n\nYour balance: $${user.balance}\nRequired: $${service.price}\n\nUse /add_funds to add funds.`);
//       return;
//     }

//     // Generate dummy V2Ray link
//     const vlessLink = `vless://${Math.random().toString(36).substring(2)}@server.example.com:443?security=tls&sni=v2ray.com&type=ws&path=/v2ray#${service.name}`;
    
//     // Deduct balance
//     await db.updateUserBalance(user.id, -service.price);
    
//     // Create config
//     await db.createUserConfig(user.id, service.id, vlessLink, 'active', service.duration_days);

//     await ctx.answerCbQuery('✅ Purchase successful!');
    
//     await ctx.editMessageText(`🎉 Purchase Successful!\n\nService: ${service.name}\nExpires: In ${service.duration_days} days\n\nYour V2Ray Config:\n\`${vlessLink}\`\n\n📋 Use /my_services to view all your configs.`, {
//       parse_mode: 'Markdown'
//     });
//   }

//   async handleCancelPurchase(ctx: any) {
//     await ctx.answerCbQuery('Purchase cancelled');
//     await ctx.deleteMessage();
//   }

//   async handleMyServices(ctx: Context) {
//     const user = await db.getUserByTelegramId(ctx.from!.id);
//     const configs = await db.getUserConfigs(user.id);

//     if (configs.length === 0) {
//       await ctx.reply('📭 You have no active configs.\nUse /buy to purchase a config or /test_config for a free test.');
//       return;
//     }

//     let message = '📋 Your Active Configs:\n\n';
    
//     configs.forEach((config, index) => {
//       const expiresDate = new Date(config.expires_at).toLocaleDateString();
//       const remainingDays = Math.ceil((new Date(config.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
//       message += `${index + 1}. ${config.service_name}\n`;
//       message += `   Status: ${config.status}\n`;
//       message += `   Expires: ${expiresDate} (${remainingDays} days left)\n`;
//       message += `   Data: ${config.data_used_gb.toFixed(2)} GB used`;
//       if (config.data_limit_gb) {
//         message += ` / ${config.data_limit_gb} GB limit\n`;
//       } else {
//         message += ' / Unlimited\n';
//       }
//       message += `   Link: \`${config.vless_link}\`\n\n`;
//     });

//     await ctx.reply(message, {
//       parse_mode: 'Markdown'
//     });
//   }

//   async handleTestConfig(ctx: Context) {
//     const user = await db.getUserByTelegramId(ctx.from!.id);
    
//     const hasTest = await db.hasTestConfig(user.id);
//     if (hasTest) {
//       await ctx.reply('⚠️ You have already used your free test config.');
//       return;
//     }

//     // Generate dummy test config
//     const vlessLink = `vless://${Math.random().toString(36).substring(2)}@test.server.example.com:443?security=tls&sni=test.v2ray.com&type=ws&path=/test#Free-Test`;
    
//     // Create test config (3 days free)
//     await db.createUserConfig(user.id, 0, vlessLink, 'test', 3);

//     await ctx.reply(`🎉 Free Test Config Activated!\n\nThis test config will expire in 3 days.\n\nYour V2Ray Config:\n\`${vlessLink}\`\n\n💡 Use /buy to purchase a full config.`, {
//       parse_mode: 'Markdown'
//     });
//   }

//   async handleAddFunds(ctx: Context) {
//     await ctx.reply('💵 How much would you like to add to your balance?\n\nPlease enter the amount in USD (e.g., 10, 25, 50):');
    
//     // Store state for next message
//     // In a real implementation, use session or state management
//   }

//   async handleText(ctx: Context) {
//     const text = (ctx.message as any).text;
//     const user = await db.getUserByTelegramId(ctx.from!.id);
    
//     // Check if user is in payment process
//     if (!isNaN(parseFloat(text)) && parseFloat(text) > 0) {
//       const amount = parseFloat(text);
//       const cardNumber = process.env.PAYMENT_CARD_NUMBER || '1234-5678-9012-3456';
      
//       const payment = await db.createPayment(user.id, amount, cardNumber);
      
//       const message = `
// 💰 Payment Invoice #${payment.invoice_number}

// Amount: $${amount.toFixed(2)}
// Card Number: ${cardNumber}
// Bank: Example Bank
// Account Holder: Your Company Name

// Please transfer exactly $${amount.toFixed(2)} to the card number above.
// Then click "I've Paid" below and send the receipt photo.
//       `;

//       await ctx.reply(message, {
//         reply_markup: {
//           inline_keyboard: [
//             [
//               Markup.button.callback('✅ I\'ve Paid', `payed_${payment.id}`),
//               Markup.button.callback('❌ Cancel Payment', `cancel_payment_${payment.id}`)
//             ]
//           ]
//         }
//       });
//     }
//   }

//   async handlePaymentMade(ctx: any) {
//     const paymentId = parseInt(ctx.match[1]);
    
//     await ctx.answerCbQuery('Please send the receipt photo now');
//     await ctx.editMessageText('📸 Please send the receipt photo as an image.\n\nYour payment will be processed once we verify the receipt.');
    
//     // Store paymentId in session for photo handler
//   }

//   async handlePhoto(ctx: Context) {
//     const user = await db.getUserByTelegramId(ctx.from!.id);
    
//     // Get the latest pending payment for user
//     const result = await db.query(
//       'SELECT * FROM payments WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
//       [user.id, 'pending']
//     );
    
//     if (result.rows.length === 0) {
//       await ctx.reply('No pending payment found. Please start payment process with /add_funds');
//       return;
//     }

//     const payment = result.rows[0];
//     const photo = (ctx.message as any).photo.pop();
    
//     // Update payment with receipt photo (in real app, download and store)
//     await db.query(
//       'UPDATE payments SET receipt_photo = $1 WHERE id = $2',
//       [`photo_${photo.file_id}`, payment.id]
//     );

//     // Notify admins
//     for (const adminChatId of this.adminChatIds) {
//       try {
//         const adminMessage = await this.bot.telegram.sendPhoto(
//           adminChatId,
//           photo.file_id,
//           {
//             caption: `💰 Payment Verification Required\n\nInvoice: #${payment.invoice_number}\nUser: @${user.username || 'N/A'} (ID: ${user.telegram_id})\nAmount: $${payment.amount}\nCard: ${payment.card_number}`,
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   Markup.button.callback('✅ Confirm Payment', `confirm_payment_${payment.id}`),
//                   Markup.button.callback('❌ Decline Payment', `decline_payment_${payment.id}`)
//                 ]
//               ]
//             }
//           }
//         );

//         // Store admin message info
//         await db.query(
//           'UPDATE payments SET admin_message_id = $1, admin_chat_id = $2 WHERE id = $3',
//           [adminMessage.message_id, adminChatId, payment.id]
//         );
//       } catch (error) {
//         console.error('Error sending to admin:', error);
//       }
//     }

//     await ctx.reply('✅ Receipt received! Admins have been notified. Your payment will be processed shortly.\n\nYou will receive a notification when it\'s confirmed.');
//   }

//   async handleAdminConfirmPayment(ctx: any) {
//     const paymentId = parseInt(ctx.match[1]);
//     const payment = await db.getPaymentById(paymentId);
    
//     if (!payment) {
//       await ctx.answerCbQuery('Payment not found');
//       return;
//     }

//     // Update payment status
//     await db.updatePaymentStatus(paymentId, 'confirmed');
    
//     // Update user balance
//     await db.updateUserBalance(payment.user_id, payment.amount);

//     // Notify user
//     await this.bot.telegram.sendMessage(
//       payment.telegram_id,
//       `✅ Payment Confirmed!\n\nAmount: $${payment.amount}\nNew Balance: $${payment.amount}\n\nThank you for your payment!`
//     );

//     // Update admin message
//     await ctx.editMessageText(`✅ Payment #${payment.invoice_number} confirmed.\nUser: @${payment.username || 'N/A'}\nAmount: $${payment.amount}\nStatus: CONFIRMED`, {
//       reply_markup: {
//         inline_keyboard: []
//       }
//     });

//     await ctx.answerCbQuery('Payment confirmed');
//   }

//   async handleAdminDeclinePayment(ctx: any) {
//     const paymentId = parseInt(ctx.match[1]);
//     const payment = await db.getPaymentById(paymentId);
    
//     if (!payment) {
//       await ctx.answerCbQuery('Payment not found');
//       return;
//     }

//     await db.updatePaymentStatus(paymentId, 'declined');

//     // Notify user
//     await this.bot.telegram.sendMessage(
//       payment.telegram_id,
//       `❌ Payment Declined\n\nPayment #${payment.invoice_number} has been declined.\n\nPlease contact support if you believe this is an error.`
//     );

//     await ctx.editMessageText(`❌ Payment #${payment.invoice_number} declined.\nUser: @${payment.username || 'N/A'}\nAmount: $${payment.amount}\nStatus: DECLINED`, {
//       reply_markup: {
//         inline_keyboard: []
//       }
//     });

//     await ctx.answerCbQuery('Payment declined');
//   }

//   async handleCancelPayment(ctx: any) {
//     const paymentId = parseInt(ctx.match[1]);
//     await db.updatePaymentStatus(paymentId, 'cancelled');
    
//     await ctx.answerCbQuery('Payment cancelled');
//     await ctx.deleteMessage();
//   }

//   async handleMyAccount(ctx: Context) {
//   const user = await db.getUserByTelegramId(ctx.from!.id);
  
//   // Get active services count
//   const configs = await db.getUserConfigs(user.id);
  
//   const message = `
// 👤 Account Information:

// User ID: ${user.id}
// Telegram ID: ${user.telegram_id}
// Username: ${user.username ? '@' + user.username : 'N/A'}
// Name: ${user.first_name} ${user.last_name || ''}
// Account Created: ${new Date(user.created_at).toLocaleDateString()}

// 💰 Balance: $${Number(user.balance)}
// 📡 Active Configs: ${configs.length}
// 🔄 Status: ${user.is_active ? 'Active ✅' : 'Inactive ❌'}

// 💳 Use /add_funds to add balance
// 📦 Use /buy to purchase configs
//     `;

//   await ctx.reply(message, {
//     parse_mode: 'HTML',  // Change from 'Markdown' to 'HTML' or remove entirely
//   });
// }

//   async handleSupport(ctx: Context) {
//     const user = await db.getUserByTelegramId(ctx.from!.id);
    
//     const message = `
// 🛠️ Support

// If you need assistance, please contact our support team directly via Telegram.

// Your User ID: \`${user.telegram_id}\`
// Please include this ID when contacting support.

// Support Contact: @v2ray_support
//     `;

//     await ctx.reply(message, {
//       parse_mode: 'Markdown'
//     });
//   }

//   async handleHowToUse(ctx: Context) {
//     const channelLink = process.env.TUTORIAL_CHANNEL || 'https://t.me/v2ray_tutorials';
    
//     const message = `
// 📚 How to Use

// For tutorials and guides on how to use V2Ray configs, please join our tutorial channel.

// Join here: ${channelLink}

// In the channel you'll find:
// • Setup guides for different platforms
// • Troubleshooting tips
// • Usage instructions
// • Latest updates
//     `;

//     await ctx.reply(message, {
//       parse_mode: 'Markdown',
//       reply_markup: {
//         inline_keyboard: [
//           [Markup.button.url('Join Tutorial Channel', channelLink)]
//         ]
//       }
//     });
//   }

//   launch() {
//     this.bot.launch();
//     console.log('🤖 Bot started successfully');
    
//     // Enable graceful stop
//     process.once('SIGINT', () => this.bot.stop('SIGINT'));
//     process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
//   }
// }


import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import db from '../database/database.service';
import { BotMessages } from './messages';

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
    this.bot.command('test_config', (ctx) => this.handleTestConfig(ctx));
    this.bot.command('add_funds', (ctx) => this.handleAddFunds(ctx));
    this.bot.command('my_account', (ctx) => this.handleMyAccount(ctx));
    this.bot.command('support', (ctx) => this.handleSupport(ctx));
    this.bot.command('how_to_use', (ctx) => this.handleHowToUse(ctx));
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

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      ...Markup.keyboard([
        ['/buy', '/my_services'],
        ['/test_config', '/add_funds'],
        ['/my_account', '/support']
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

  async handleConfirmPurchase(ctx: any) {
    const serviceId = parseInt(ctx.match[1]);
    const service = await db.getServiceById(serviceId);
    const user = await db.getUserByTelegramId(ctx.from.id);

    if (Number(user.balance) < service.price) {
      await ctx.answerCbQuery(BotMessages.callbackAnswers.insufficientFunds);
      await ctx.editMessageText(
        BotMessages.insufficientFunds(user.balance, service.price),
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    // Generate dummy V2Ray link
    const vlessLink = `vless://${Math.random().toString(36).substring(2)}@server.example.com:443?security=tls&sni=v2ray.com&type=ws&path=/v2ray#${service.name}`;
    
    // Deduct balance
    await db.updateUserBalance(user.id, -service.price);
    
    // Create config
    await db.createUserConfig(user.id, service.id, vlessLink, 'active', service.duration_days);

    await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseSuccessful);
    
    await ctx.editMessageText(
      BotMessages.purchaseSuccessful(service, vlessLink),
      { parse_mode: 'MarkdownV2' }
    );
  }

  async handleCancelPurchase(ctx: any) {
    await ctx.answerCbQuery(BotMessages.callbackAnswers.purchaseCancelled);
    await ctx.deleteMessage();
  }

  async handleMyServices(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    const configs = await db.getUserConfigs(user.id);

    if (configs.length === 0) {
      await ctx.reply(BotMessages.noActiveConfigs(), { parse_mode: 'MarkdownV2' });
      return;
    }

    const message = BotMessages.userConfigs(configs);
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  }

  async handleTestConfig(ctx: Context) {
    const user = await db.getUserByTelegramId(ctx.from!.id);
    
    const hasTest = await db.hasTestConfig(user.id);
    if (hasTest) {
      await ctx.reply(BotMessages.alreadyUsedTest(), { parse_mode: 'MarkdownV2' });
      return;
    }

    // Generate dummy test config
    const vlessLink = `vless://${Math.random().toString(36).substring(2)}@test.server.example.com:443?security=tls&sni=test.v2ray.com&type=ws&path=/test#Free-Test`;
    
    // Create test config (3 days free)
    await db.createUserConfig(user.id, 0, vlessLink, 'test', 3);

    await ctx.reply(
      BotMessages.testConfigActivated(vlessLink),
      { parse_mode: 'MarkdownV2' }
    );
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
    await ctx.editMessageText(
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

    await ctx.editMessageText(
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
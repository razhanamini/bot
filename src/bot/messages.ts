export class BotMessages {
  // Helper method to escape MarkdownV2 special characters
  static escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  // Helper method to format balance with 2 decimals
//   static formatBalance(balance: number | string): string {
//     return Number(balance).toFixed(2);
//   }

  // Welcome message for /start command
  static welcomeMessage(user: any): string {
    const balance = user.balance;
    const username = user.username ? `@${this.escapeMarkdown(user.username)}` : 'N/A';
    
    return `🎉 *Welcome to V2Ray Config Bot\\!*

👤 *User Information:*
*ID:* ${user.id}
*Username:* ${username}
*Balance:* \\$${balance}

*Available Commands:*
/buy - Purchase V2Ray config
/my\\_services - View your active configs
/test\\_config - Get free test config
/add\\_funds - Add funds to your account
/my\\_account - View account details
/support - Contact support
/how\\_to\\_use - Tutorials and guides`;
  }

  // No services available
  static noServicesAvailable(): string {
    return `⚠️ No services available at the moment\\.`;
  }

  // Available services list
  static availableServices(): string {
    return `📋 *Available Services:*`;
  }

  // Service details
  static serviceDetails(service: any): string {
    const dataLimit = service.data_limit_gb 
      ? `${service.data_limit_gb} GB` 
      : 'Unlimited';
    
    return `📦 *Service Details:*
*Name:* ${this.escapeMarkdown(service.name)}
*Price:* \\$${service.price}
*Duration:* ${service.duration_days} days
*Data Limit:* ${dataLimit}
*Description:* ${this.escapeMarkdown(service.description)}

*Proceed with purchase?*`;
  }

  // Insufficient funds
  static insufficientFunds(userBalance: number | string, servicePrice: number): string {
    const balance = userBalance;
    return `⚠️ *Insufficient balance\\!*

*Your balance:* \\$${balance}
*Required:* \\$${servicePrice}

Use /add\\_funds to add funds\\.`;
  }

  // Purchase successful
  static purchaseSuccessful(service: any, vlessLink: string): string {
    return `🎉 *Purchase Successful\\!*

*Service:* ${this.escapeMarkdown(service.name)}
*Expires:* In ${service.duration_days} days

*Your V2Ray Config:*
\`${vlessLink}\`

📋 Use /my\\_services to view all your configs\\.`;
  }

  // No active configs
  static noActiveConfigs(): string {
    return `📭 You have no active configs\\.  
Use /buy to purchase a config or /test\\_config for a free test\\.`;
  }

  // User configs list
  static userConfigs(configs: any[]): string {
    let message = `📋 *Your Active Configs:*\n\n`;
    
    configs.forEach((config, index) => {
      const expiresDate = new Date(config.expires_at).toLocaleDateString();
      const remainingDays = Math.ceil((new Date(config.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const dataUsed = Number(config.data_used_gb).toFixed(2);
      const dataLimit = config.data_limit_gb ? ` / ${config.data_limit_gb} GB limit` : ' / Unlimited';
      
      message += `${index + 1}\\. *${this.escapeMarkdown(config.service_name)}*\n`;
      message += `   *Status:* ${config.status}\n`;
      message += `   *Expires:* ${expiresDate} \\(${remainingDays} days left\\)\n`;
      message += `   *Data:* ${dataUsed} GB used${dataLimit}\n`;
      message += `   *Link:* \`${config.vless_link}\`\n\n`;
    });

    return message;
  }

  // Already used test config
  static alreadyUsedTest(): string {
    return `⚠️ You have already used your free test config\\.`;
  }

  // Test config activated
  static testConfigActivated(vlessLink: string): string {
    return `🎉 *Free Test Config Activated\\!*

This test config will expire in 3 days\\.

*Your V2Ray Config:*
\`${vlessLink}\`

💡 Use /buy to purchase a full config\\.`;
  }

  // Add funds prompt
  static addFundsPrompt(): string {
    return `💵 *How much would you like to add to your balance\\?*

Please enter the amount in USD \\(e\\.g\\., 10, 25, 50\\):`;
  }

  // Payment invoice
  static paymentInvoice(payment: any, amount: number): string {
    const formattedAmount = amount;
    return `💰 *Payment Invoice* \\#${payment.invoice_number}

*Amount:* \\$${formattedAmount}
*Card Number:* ${payment.card_number}
*Bank:* Example Bank
*Account Holder:* Your Company Name

Please transfer exactly \\$${formattedAmount} to the card number above\\.  
Then click "I\\'ve Paid" below and send the receipt photo\\.`;
  }

  // Payment made prompt
  static paymentMadePrompt(): string {
    return `📸 *Please send the receipt photo as an image\\.*

Your payment will be processed once we verify the receipt\\.`;
  }

  // No pending payment
  static noPendingPayment(): string {
    return `No pending payment found\\. Please start payment process with /add\\_funds`;
  }

  // Receipt received
  static receiptReceived(): string {
    return `✅ *Receipt received\\!* Admins have been notified\\. Your payment will be processed shortly\\.  

You will receive a notification when it\\'s confirmed\\.`;
  }

  // Payment confirmed (user notification)
  static paymentConfirmedUser(amount: number | string): string {
    const formattedAmount = amount;
    return `✅ *Payment Confirmed\\!*

*Amount:* \\$${formattedAmount}
*New Balance:* \\$${formattedAmount}

Thank you for your payment\\!`;
  }

  // Payment confirmed (admin notification)
  static paymentConfirmedAdmin(payment: any): string {
    const username = payment.username ? `@${this.escapeMarkdown(payment.username)}` : 'N/A';
    return `✅ *Payment* \\#${payment.invoice_number} *confirmed\\.*
*User:* ${username}
*Amount:* \\$${payment.amount}
*Status:* CONFIRMED`;
  }

  // Payment declined (user notification)
  static paymentDeclinedUser(payment: any): string {
    return `❌ *Payment Declined*

Payment \\#${payment.invoice_number} has been declined\\.  

Please contact support if you believe this is an error\\.`;
  }

  // Payment declined (admin notification)
  static paymentDeclinedAdmin(payment: any): string {
    const username = payment.username ? `@${this.escapeMarkdown(payment.username)}` : 'N/A';
    return `❌ *Payment* \\#${payment.invoice_number} *declined\\.*
*User:* ${username}
*Amount:* \\$${payment.amount}
*Status:* DECLINED`;
  }

  // My account information
  static accountInformation(user: any, configsCount: number): string {
    const balance = user.balance;
    const username = user.username ? `@${this.escapeMarkdown(user.username)}` : 'NOUSERNAME';
    const name = `${this.escapeMarkdown(user.first_name)} ${user.last_name ? this.escapeMarkdown(user.last_name) : ''}`.trim();
    const accountCreated = new Date(user.created_at).toLocaleDateString();
    const status = user.is_active ? 'Active ✅' : 'Inactive ❌';
    
    return `👤 *Account Information:*

*User ID:* ${user.id}
*Telegram ID:* ${user.telegram_id}
*Username:* ${username}
*Name:* ${name}
*Account Created:* ${this.escapeMarkdown(accountCreated)}

💰 *Balance:* \\$${balance}
📡 *Active Configs:* ${configsCount}
🔄 *Status:* ${status}

💳 Use /add\\_funds to add balance
📦 Use /buy to purchase configs`;
  }

  // Support message
  static supportMessage(telegramId: number): string {
    return `🛠️ *Support*

If you need assistance, please contact our support team directly via Telegram\\.

*Your User ID:* \`${telegramId}\`  
Please include this ID when contacting support\\.

*Support Contact:* v2raysupportid`;
  }

  // How to use message
  static howToUse(channelLink: string): string {
    return `📚 *How to Use*

For tutorials and guides on how to use V2Ray configs, please join our tutorial channel\\.

*Join here:* ${channelLink}

*In the channel you\\'ll find:*
• Setup guides for different platforms
• Troubleshooting tips
• Usage instructions
• Latest updates`;
  }

  // Payment verification required (admin)
  static paymentVerificationRequired(payment: any, user: any): string {
    const username = user.username ? `@${this.escapeMarkdown(user.username)}` : 'N/A';
    return `💰 *Payment Verification Required*

*Invoice:* \\#${payment.invoice_number}
*User:* ${username} \\(ID: ${user.telegram_id}\\)
*Amount:* \\$${payment.amount}
*Card:* ${payment.card_number}`;
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
}


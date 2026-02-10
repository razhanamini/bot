import { UserConfig } from "../database/models/config.model";
import { Payment } from "../database/models/payment.model";
import { Service } from "../database/models/service.model";
import { VlessLinkGenerator, VlessLinkSet } from "../types/v2ray.links";
import format from 'telegram-format';

export class BotMessages {
  // Helper method to escape MarkdownV2 special characters
  static escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  // Welcome message for /start command
  static welcomeMessage(user: any): string {
    const balance = Math.floor(user.balance);
    const username = user.username ? `${this.escapeMarkdown(user.username)}` : 'N/A';
    
    return `🎉 *Welcome to V2Ray Config Bot*

👤 *User Information:*
*ID:* ${user.id}
*Username:* ${username}
*Balance:* \\$${balance}

*Available Commands:*
/buy  \\- Purchase V2Ray config
/my_services  \\- View your active configs
/test_config  \\- Get free test config
/add_funds  \\- Add funds to your account
/my_account  \\- View account details
/support  \\- Contact support
/how_to_use  \\- Tutorials and guides`;
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
  static serviceDetails(service: Service): string {
    const dataLimit = Math.floor(service.data_limit_gb); 
       `${service.data_limit_gb} GB`    
    return `📦 *Service Details:*
*Name:* ${this.escapeMarkdown(service.name)}
*Price:* \\$${Math.floor(service.price)}
*Duration:* ${service.duration_days} days
*Data Limit:* ${dataLimit}
*Description:* ${this.escapeMarkdown(service.description)}

*Proceed with purchase\\?*`;
  }

  // Insufficient funds
  static insufficientFunds(userBalance: number, servicePrice: number): string {
    const balance = Math.floor(userBalance);
    return `⚠️ *Insufficient balance\\!*

*Your balance:* \\$${balance}
*Required:* \\$${Math.floor(servicePrice)}

Use /add\\_funds to add funds\\.`;
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
    return `📭 You have no active configs\\.  
Use /buy to purchase a config or /test\\_config for a free test\\.`;
  }

  // User configs list
  static userConfigs(configs: UserConfig[]): string {
    let message = `📋 *Your Active Configs:*\n\n`;
    
    
    configs.forEach((config, index) => {
      const expiresDate = new Date(config.expires_at).toLocaleDateString();
      const remainingDays = Math.ceil((new Date(config.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const dataUsed = Math.floor(config.data_used_gb);
      // const dataLimit = config.data_limit_gb ? ` / ${config.data_limit_gb} GB limit` : ' / Unlimited';
      
      message += `${index + 1}\\. *${config.service_id}*\n`;
      message += `   *Status:* ${config.status}\n`;
      message += `   *Expires:* ${expiresDate} \\(${remainingDays} days left\\)\n`;
      message += `   *Data:* ${dataUsed} GB used\n`;
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
  
  return `💰 *Payment Invoice* \\#${this.escapeMarkdown(payment.invoice_number)}

*Amount:* \\$${formattedAmount}
*Card Number:* ${this.escapeMarkdown(payment.card_number)}
*Bank:* ${this.escapeMarkdown('1234 5678 9123 1233')}
*Account Holder:* ${this.escapeMarkdown('Your Company Name')}

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
  static paymentConfirmedUser(amount: number ): string {
    const formattedAmount = Math.floor(amount);
    return `✅ *Payment Confirmed\\!*

*Amount:* \\$${formattedAmount}
*New Balance:* \\$${formattedAmount}

Thank you for your payment\\!`;
  }

  // Payment confirmed (admin notification)
  static paymentConfirmedAdmin(payment: Payment): string {
    const username = payment.user_id ;
    return `✅ *Payment* \\#${this.escapeMarkdown(payment.invoice_number)} *confirmed\\.*
*User:* ${username}
*Amount:* \\$${Math.floor(payment.amount)}
*Status:* CONFIRMED`;
  }

  // Payment declined (user notification)
  static paymentDeclinedUser(payment: any): string {
    return `❌ *Payment Declined*

Payment \\#${this.escapeMarkdown(payment.invoice_number)} has been declined\\.  

Please contact support if you believe this is an error\\.`;
  }

  // Payment declined (admin notification)
  static paymentDeclinedAdmin(payment: Payment): string {
    const username = payment.user_id;
    return `❌ *Payment* \\#${this.escapeMarkdown(payment.invoice_number)} *declined\\.*
*User:* ${username}
*Amount:* \\$${Math.floor(payment.amount)}
*Status:* DECLINED`;
  }

  // My account information
  static accountInformation(user: any, configsCount: number): string {
    const balance = Math.floor(user.balance);
    const username = user.username ? `${this.escapeMarkdown(user.username)}` : 'NOUSERNAME';
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
// Payment verification required (admin)
static paymentVerificationRequired(payment: any, user: any): string {
  const username = user.username ? this.escapeMarkdown(user.username) : 'N/A';

  return `💰 *Payment Verification Required*

*Invoice:* \\#${this.escapeMarkdown(payment.invoice_number)}
*User:* ${username} \\(ID: ${user.telegram_id}\\)
*Amount:* \\$${Math.floor(payment.amount)}
*Card:* ${this.escapeMarkdown(payment.card_number)}`;
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




  static purchaseSuccessful(service: any, links: VlessLinkSet): string {
    return VlessLinkGenerator.formatForDisplay(links) + '\n\n' +
      `🎉 *Purchase Successful\\!*\n\n` +
      `*Service:* ${this.escapeMarkdown(service.name)}\n` +
      `*Expires:* In ${service.duration_days} days\n\n` +
      `📋 Use /my\\_services to view all your configs\\.`;
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
      `\`${platformLink}\`\n\n` +
      `Copy this link and import it into your V2Ray client\\.`;
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


  static userServices(services: any[]): string {
    if (services.length === 0) {
      return this.noActiveConfigs();
    }

    let message = `📋 *Your Services Summary*\n\n`;
    
    // Count by status
    const activeCount = services.filter(s => s.status === 'active').length;
    const testCount = services.filter(s => s.status === 'test').length;
    const suspendedCount = services.filter(s => s.status === 'suspended').length;
    const expiredCount = services.filter(s => s.status === 'expired').length;
    
    const totalDataUsed = services.reduce((sum, s) => sum + parseFloat(s.data_used_gb || 0), 0);
    
    message += `✅ ${this.bold('Active:')} ${activeCount}\n`;
    message += `🧪 ${this.bold('Test:')} ${testCount}\n`;
    message += `⏸️ ${this.bold('Suspended:')} ${suspendedCount}\n`;
    message += `⏰ ${this.bold('Expired:')} ${expiredCount}\n\n`;
    
    message += `💾 ${this.bold('Total Data Used:')} ${this.escapeMarkdown(totalDataUsed.toFixed(2))} GB\n\n`;
    
    // List active services only (for compact view)
    const activeServices = services.filter(s => s.status === 'active');
    if (activeServices.length > 0) {
      message += `${this.bold('📡 Active Services:')}\n`;
      activeServices.forEach((service, index) => {
        const dataUsed = parseFloat(service.data_used_gb || 0).toFixed(2);
        const dataLimit = service.data_limit_gb 
          ? `${this.escapeMarkdown(service.data_limit_gb.toString())} GB` 
          : 'Unlimited';
        const remainingDays = Math.ceil(
          (new Date(service.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        
        const serviceName = service.service_name || 'Service';
        message += `\n${index + 1}\\. ${this.bold(this.escapeMarkdown(serviceName))}\n`;
        message += `   📊 ${this.escapeMarkdown(dataUsed)} GB / ${dataLimit}\n`;
        message += `   ⏰ ${this.escapeMarkdown(remainingDays.toString())} days remaining\n`;
      });
    }
    
    message += '\n💡 For detailed view of all services, use /my\\_services\\_detailed';
    
    return message;
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
      const remainingDays = Math.ceil(
        (new Date(service.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
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


}

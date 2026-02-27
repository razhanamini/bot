import { router } from './api/GET/get.links.endpoint';
import { BotService } from './bot/bot.services';
import v2rayService from './services/v2ray.services';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();
const app = express();


// Validate environment variables
const requiredEnvVars = ['BOT_TOKEN', 'DATABASE_URL', 'ADMIN_CHAT_IDS'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

console.log('🚀 Starting V2Ray Telegram Bot...');

async function initializeServices() {
  try {
    // 1. Create bot service first
    const botService = new BotService();

    console.log('🤖 Bot service created');

    // 2. Set bot service for V2Ray service notifications
    v2rayService.setBotService(botService);
    console.log('🔗 Bot service linked to V2Ray service');

    // 3. Start V2Ray monitoring if enabled
    if (process.env.ENABLE_XRAY_MONITORING === 'true') {
      console.log('⏰ Starting V2Ray service monitoring...');
      v2rayService.startMonitoring();
    } else {
      console.log('⏰ V2Ray monitoring disabled (ENABLE_XRAY_MONITORING not set to true)');
    }

    // 4. Launch the bot
    botService.launch();

    // 5.lanuch get endpoint for subs
    app.use(router);
    app.listen(3000, () => {
      console.log('🌐 Subscription server running on port 3000');
    });

    console.log('✅ All services started successfully');

  } catch (error: any) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

initializeServices();
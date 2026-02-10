import { BotService } from './bot/bot.services';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
const requiredEnvVars = ['BOT_TOKEN', 'DATABASE_URL', 'ADMIN_CHAT_IDS'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

console.log('🚀 Starting V2Ray Telegram Bot...');

const botService = new BotService();
botService.launch();
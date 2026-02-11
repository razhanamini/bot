"use strict";
// import { BotService } from './bot/bot.services';
// import dotenv from 'dotenv';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// dotenv.config();
// // Validate environment variables
// const requiredEnvVars = ['BOT_TOKEN', 'DATABASE_URL', 'ADMIN_CHAT_IDS'];
// const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
// if (missingEnvVars.length > 0) {
//   console.error('❌ Missing required environment variables:', missingEnvVars);
//   process.exit(1);
// }
// console.log('🚀 Starting V2Ray Telegram Bot...');
// const botService = new BotService();
// botService.launch();
const bot_services_1 = require("./bot/bot.services");
const v2ray_services_1 = __importDefault(require("./services/v2ray.services"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
        const botService = new bot_services_1.BotService();
        console.log('🤖 Bot service created');
        // 2. Set bot service for V2Ray service notifications
        v2ray_services_1.default.setBotService(botService);
        console.log('🔗 Bot service linked to V2Ray service');
        // 3. Start V2Ray monitoring if enabled
        if (process.env.ENABLE_XRAY_MONITORING === 'true') {
            console.log('⏰ Starting V2Ray service monitoring...');
            v2ray_services_1.default.startMonitoring();
        }
        else {
            console.log('⏰ V2Ray monitoring disabled (ENABLE_XRAY_MONITORING not set to true)');
        }
        // 4. Launch the bot
        botService.launch();
        console.log('✅ All services started successfully');
    }
    catch (error) {
        console.error('❌ Failed to initialize services:', error);
        process.exit(1);
    }
}
initializeServices();
//# sourceMappingURL=index.js.map
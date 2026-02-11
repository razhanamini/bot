"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
// import { Server } from 'http';
dotenv_1.default.config();
class DatabaseService {
    constructor() {
        this.pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }
    async query(text, params) {
        return this.pool.query(text, params);
    }
    async getUserByTelegramId(telegramId) {
        const result = await this.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
        return result.rows[0];
    }
    async createUser(telegramId, username, firstName, lastName) {
        const result = await this.query(`INSERT INTO users (telegram_id, username, first_name, last_name, balance, created_at, updated_at, is_active)
       VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), true)
       ON CONFLICT (telegram_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           updated_at = NOW()
       RETURNING *`, [telegramId, username, firstName, lastName]);
        return result.rows[0];
    }
    async getServices() {
        const result = await this.query('SELECT * FROM services WHERE is_active = true ORDER BY price');
        return result.rows;
    }
    async getServiceById(serviceId) {
        const result = await this.query('SELECT * FROM services WHERE id = $1 AND is_active = true', [serviceId]);
        return result.rows[0];
    }
    async getUserConfigs(userId) {
        const result = await this.query(`SELECT uc.*, s.name as service_name, s.duration_days, s.data_limit_gb
       FROM user_configs uc
       JOIN services s ON uc.service_id = s.id
       WHERE uc.user_id = $1 AND uc.status = 'active'
       ORDER BY uc.expires_at DESC`, [userId]);
        return result.rows;
    }
    async createPayment(userId, amount, cardNumber) {
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await this.query(`INSERT INTO payments (user_id, amount, status, invoice_number, card_number, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())
       RETURNING *`, [userId, amount, invoiceNumber, cardNumber]);
        return result.rows[0];
    }
    async updatePaymentStatus(paymentId, status, adminMessageId, adminChatId) {
        const result = await this.query(`UPDATE payments 
       SET status = $1, updated_at = NOW(),
           admin_message_id = COALESCE($3, admin_message_id),
           admin_chat_id = COALESCE($4, admin_chat_id)
       WHERE id = $2
       RETURNING *`, [status, paymentId, adminMessageId, adminChatId]);
        return result.rows[0];
    }
    async updateUserBalance(userId, amount) {
        const result = await this.query(`UPDATE users 
       SET balance = balance + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`, [amount, userId]);
        return result.rows[0];
    }
    async createUserConfig(userId, serviceId, vlessLink, status, durationDays) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
        const result = await this.query(`INSERT INTO user_configs (user_id, service_id, vless_link, status, expires_at, created_at, updated_at, data_used_gb)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0)
       RETURNING *`, [userId, serviceId, vlessLink, status, expiresAt]);
        return result.rows[0];
    }
    async hasTestConfig(userId) {
        const result = await this.query(`SELECT COUNT(*) as count 
       FROM user_configs 
       WHERE user_id = $1 AND status = 'test'`, [userId]);
        return parseInt(result.rows[0].count) > 0;
    }
    async getPaymentById(paymentId) {
        const result = await this.query('SELECT p.*, u.telegram_id, u.username FROM payments p JOIN users u ON p.user_id = u.id WHERE p.id = $1', [paymentId]);
        return result.rows[0];
    }
    async getUserServices(userId) {
        const result = await this.query(`SELECT 
      uc.id as config_id,
      uc.status,
      uc.expires_at,
      uc.created_at,
      uc.updated_at,
      uc.data_used_gb,
      uc.data_limit_gb,
      s.id as service_id,
      s.name as service_name,
      s.description as service_description,
      s.duration_days as service_duration,
      s.price as service_price
    FROM user_configs uc
    LEFT JOIN services s ON uc.service_id = s.id
    WHERE uc.user_id = $1
    ORDER BY 
      CASE uc.status 
        WHEN 'active' THEN 1
        WHEN 'test' THEN 2
        WHEN 'suspended' THEN 3
        WHEN 'expired' THEN 4
        ELSE 5
      END,
      uc.expires_at DESC`, [userId]);
        return result.rows;
    }
    // ================ SERVER METHODS ================
    async getAvailableServers() {
        const result = await this.query(`SELECT * FROM servers 
         WHERE status = 'active' 
         AND is_active = true 
         AND current_users < max_users
         ORDER BY current_users ASC, id ASC`, []);
        return result.rows;
    }
    async getAllActiveServers() {
        const result = await this.query(`SELECT * FROM servers 
         WHERE status = 'active' 
         AND is_active = true
         ORDER BY id ASC`, []);
        return result.rows;
    }
    async getServerById(id) {
        const result = await this.query('SELECT * FROM servers WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async incrementServerUsers(serverId) {
        await this.query(`UPDATE servers 
         SET current_users = current_users + 1,
             updated_at = NOW()
         WHERE id = $1`, [serverId]);
    }
    async decrementServerUsers(serverId) {
        await this.query(`UPDATE servers 
         SET current_users = GREATEST(current_users - 1, 0),
             updated_at = NOW()
         WHERE id = $1`, [serverId]);
    }
    async updateServerCurrentUsers(serverId, count) {
        await this.query(`UPDATE servers 
         SET current_users = $1,
             updated_at = NOW(),
             last_checked_at = NOW()
         WHERE id = $2`, [count, serverId]);
    }
    async updateServerStatus(serverId, status) {
        await this.query(`UPDATE servers 
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`, [status, serverId]);
    }
    async getServerStats() {
        const result = await this.query(`SELECT 
            COUNT(*) as total_servers,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_servers,
            SUM(current_users) as total_users,
            SUM(max_users) as total_capacity
         FROM servers 
         WHERE is_active = true`, []);
        return result.rows[0];
    }
}
exports.default = new DatabaseService();
//# sourceMappingURL=database.service.js.map
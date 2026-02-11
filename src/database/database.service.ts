import { Pool } from 'pg';
import dotenv from 'dotenv';
import { Server } from '../types/v2ray.type'
// import { Server } from 'http';

dotenv.config();

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  async getUserByTelegramId(telegramId: number) {
    const result = await this.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rows[0];
  }


  async createUser(telegramId: number, username: string | null, firstName: string, lastName: string | null) {
    const result = await this.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, balance, created_at, updated_at, is_active)
       VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), true)
       ON CONFLICT (telegram_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           updated_at = NOW()
       RETURNING *`,
      [telegramId, username, firstName, lastName]
    );
    return result.rows[0];
  }

  async getServices() {
    const result = await this.query(
      'SELECT * FROM services WHERE is_active = true ORDER BY price'
    );
    return result.rows;
  }

  async getServiceById(serviceId: number) {
    const result = await this.query(
      'SELECT * FROM services WHERE id = $1 AND is_active = true',
      [serviceId]
    );
    return result.rows[0];
  }

  async getUserConfigs(userId: number) {
    const result = await this.query(
      `SELECT uc.*, s.name as service_name, s.duration_days, s.data_limit_gb
       FROM user_configs uc
       JOIN services s ON uc.service_id = s.id
       WHERE uc.user_id = $1 AND uc.status = 'active'
       ORDER BY uc.expires_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async createPayment(userId: number, amount: number, cardNumber: string) {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await this.query(
      `INSERT INTO payments (user_id, amount, status, invoice_number, card_number, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())
       RETURNING *`,
      [userId, amount, invoiceNumber, cardNumber]
    );
    return result.rows[0];
  }

  async updatePaymentStatus(paymentId: number, status: string, adminMessageId?: number, adminChatId?: number) {
    const result = await this.query(
      `UPDATE payments 
       SET status = $1, updated_at = NOW(),
           admin_message_id = COALESCE($3, admin_message_id),
           admin_chat_id = COALESCE($4, admin_chat_id)
       WHERE id = $2
       RETURNING *`,
      [status, paymentId, adminMessageId, adminChatId]
    );
    return result.rows[0];
  }

  async updateUserBalance(userId: number, amount: number) {
    const result = await this.query(
      `UPDATE users 
       SET balance = balance + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [amount, userId]
    );
    return result.rows[0];
  }

  async createUserConfig(userId: number, serviceId: number, vlessLink: string, status: string, durationDays: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const result = await this.query(
      `INSERT INTO user_configs (user_id, service_id, vless_link, status, expires_at, created_at, updated_at, data_used_gb)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 0)
       RETURNING *`,
      [userId, serviceId, vlessLink, status, expiresAt]
    );
    return result.rows[0];
  }

  async getPaymentById(paymentId: number) {
    const result = await this.query(
      'SELECT p.*, u.telegram_id, u.username FROM payments p JOIN users u ON p.user_id = u.id WHERE p.id = $1',
      [paymentId]
    );
    return result.rows[0];
  }


  async getUserServices(userId: number): Promise<any[]> {
  const result = await this.query(
    `SELECT 
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
      uc.expires_at DESC`,
    [userId]
  );
  
  return result.rows;
}




// ================ SERVER METHODS ================

async getAvailableServers(): Promise<Server[]> {
    const result = await this.query(
        `SELECT * FROM servers 
         WHERE status = 'active' 
         AND is_active = true 
         AND current_users < max_users
         ORDER BY current_users ASC, id ASC`,
        []
    );
    return result.rows;
}

async getAllActiveServers(): Promise<Server[]> {
    const result = await this.query(
        `SELECT * FROM servers 
         WHERE status = 'active' 
         AND is_active = true
         ORDER BY id ASC`,
        []
    );
    return result.rows;
}

async getServerById(id: number): Promise<Server | null> {
    const result = await this.query(
        'SELECT * FROM servers WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

async incrementServerUsers(serverId: number): Promise<void> {
    await this.query(
        `UPDATE servers 
         SET current_users = current_users + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [serverId]
    );
}

async decrementServerUsers(serverId: number): Promise<void> {
    await this.query(
        `UPDATE servers 
         SET current_users = GREATEST(current_users - 1, 0),
             updated_at = NOW()
         WHERE id = $1`,
        [serverId]
    );
}

async updateServerCurrentUsers(serverId: number, count: number): Promise<void> {
    await this.query(
        `UPDATE servers 
         SET current_users = $1,
             updated_at = NOW(),
             last_checked_at = NOW()
         WHERE id = $2`,
        [count, serverId]
    );
}

async updateServerStatus(serverId: number, status: string): Promise<void> {
    await this.query(
        `UPDATE servers 
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [status, serverId]
    );
}

async getServerStats(): Promise<any> {
    const result = await this.query(
        `SELECT 
            COUNT(*) as total_servers,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_servers,
            SUM(current_users) as total_users,
            SUM(max_users) as total_capacity
         FROM servers 
         WHERE is_active = true`,
        []
    );
    return result.rows[0];
}



async hasTestConfig(userId: number): Promise<boolean> {
  const result = await this.query(
    `SELECT COUNT(*) as count 
     FROM user_configs 
     WHERE user_id = $1 AND status = 'test'`,
    [userId]
  );
  return parseInt(result.rows[0].count) > 0;
}

// Override createUserConfig to handle test services
async createTestUserConfig(
  userId: number, 
  vlessLink: string, 
  serverId: number,
  clientEmail: string,
  inboundTag: string
): Promise<any> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1); // 24 hours
  
  const result = await this.query(
    `INSERT INTO user_configs (
      user_id, service_id, server_id, vless_link, status, expires_at,
      data_used_gb, client_email, inbound_tag, data_limit_gb,
      port, protocol, security, network
    ) VALUES ($1, NULL, $2, $3, 'test', $4, 0, $5, $6, 1, 8445, 'vless', 'reality', 'tcp')
    RETURNING *`,
    [userId, serverId, vlessLink, expiresAt, clientEmail, inboundTag]
  );
  
  return result.rows[0];
}


}

export default new DatabaseService();
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import db from '../database/database.service';
import { BotService } from '../bot/bot.services';
import {
  V2RayConfig,
  Client,
  XrayStatusResponse,
  XrayStatusData,
  UserBandwidth,
  ServiceCreateParams,
  ServiceMonitorResult,
  Server,
  VlessLinkSet,
  VlessLinkParams,
} from '../types/v2ray.type';
import { VlessLinkGenerator } from '../types/v2ray.links';


dotenv.config();

export class V2RayService {
  private botService: BotService | null = null;
  private isMonitoringActive: boolean = false;
  private httpInstances: Map<number, AxiosInstance> = new Map();
  private realityPK = process.env.REALITY_PUBLIC_KEY;
  constructor() {
    console.log('🔧 V2Ray service initialized (multi-server mode)');
  }

  setBotService(botService: BotService) {
    this.botService = botService;
  }

  // ================ HTTP CLIENT MANAGEMENT ================

  private getHttpClient(server: Server): AxiosInstance {
    if (this.httpInstances.has(server.id)) {
      return this.httpInstances.get(server.id)!;
    }

    const http = axios.create({
      baseURL: `http://${server.ip}:${server.api_port}`,
      headers: {
        'x-api-token': server.api_token,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    http.interceptors.response.use(
      response => response,
      error => {
        console.error(`❌ Server ${server.id} (${server.name}) API error:`, error.message);
        return Promise.reject(error);
      }
    );

    this.httpInstances.set(server.id, http);
    return http;
  }

  // ================ SERVER SELECTION ================

  async selectOptimalServer(): Promise<Server> {
    console.log('🖥️ Selecting optimal server for new user...');

    const availableServers = await db.getAvailableServers();

    if (availableServers.length === 0) {
      throw new Error('No available servers with capacity');
    }

    // Select server with least current users (load balancing)
    const selectedServer = availableServers[0];

    console.log(`✅ Selected server: ${selectedServer.name} (${selectedServer.location})`);
    console.log(`📊 Current usage: ${selectedServer.current_users}/${selectedServer.max_users} users`);

    return selectedServer;
  }

  async selectOptimalTestServer(): Promise<Server> {

    console.log('🖥️ Selecting optimal server for new user...');

    const availableServers = await db.getAvailableTestServers();

    if (availableServers.length === 0) {
      throw new Error('No available servers with capacity');
    }

    // Select server with least current users (load balancing)
    const selectedServer = availableServers[0];

    console.log(`✅ Selected server: ${selectedServer.name} (${selectedServer.location})`);
    console.log(`📊 Current usage: ${selectedServer.current_users}/${selectedServer.max_users} users`);

    return selectedServer;


  }

  // ================ API METHODS (SERVER-AWARE) ================

  async getConfig(server: Server): Promise<V2RayConfig> {
    try {
      console.log(`📡 Fetching config from server ${server.name}...`);
      const http = this.getHttpClient(server);
      const response = await http.get('/api/xray/config');

      if (!response.data.success) {
        throw new Error('API returned success: false');
      }

      if (!response.data.config) {
        throw new Error('No config in response');
      }

      return response.data.config;
    } catch (error: any) {
      console.error(`❌ Error fetching config from server ${server.name}:`, error.message);
      throw new Error(`Failed to get Xray config from ${server.name}: ${error.message}`);
    }
  }

  async updateConfig(server: Server, config: V2RayConfig): Promise<boolean> {
    try {
      console.log(`📤 Updating config on server ${server.name}...`);
      const http = this.getHttpClient(server);

      const requestBody = { config };
      const response = await http.put('/api/xray/config', requestBody);

      if (!response.data.success) {
        throw new Error(`Update failed: ${response.data.message || 'Unknown error'}`);
      }

      console.log(`✅ Config updated on ${server.name}: ${response.data.message}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error updating config on server ${server.name}:`, error.message);
      throw new Error(`Failed to update config on ${server.name}: ${error.message}`);
    }
  }

  async restartService(server: Server): Promise<boolean> {
    try {
      console.log(`🔄 Restarting Xray service on server ${server.name}...`);
      const http = this.getHttpClient(server);

      const response = await http.post('/api/xray/restart');

      if (!response.data.success) {
        throw new Error(`Restart failed: ${response.data.message || 'Unknown error'}`);
      }

      console.log(`✅ Xray service restarted on ${server.name}: ${response.data.message}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error restarting Xray service on server ${server.name}:`, error.message);

      // Don't throw on restart failure - config is already updated
      console.warn(`⚠️ Service restart failed on ${server.name}, but config was updated`);
      return false;
    }
  }

  async getStatus(server: Server): Promise<XrayStatusData> {
    try {
      console.log(`📡 Fetching status from server ${server.name}...`);
      const http = this.getHttpClient(server);

      const response = await http.get('/api/xray/status');

      if (!response.data.success) {
        throw new Error('API returned success: false');
      }

      if (!response.data.data) {
        throw new Error('No data in response');
      }

      let parsedData: any;
      if (typeof response.data.data === 'string') {
        parsedData = JSON.parse(response.data.data);
      } else {
        parsedData = response.data.data;
      }

      if (!parsedData.isOk) {
        throw new Error('Xray status is not OK');
      }

      if (!parsedData.data) {
        parsedData.data = {};
      }
      if (!parsedData.data.users) {
        parsedData.data.users = [];
      }

      return parsedData;
    } catch (error: any) {
      console.error(`❌ Error fetching status from server ${server.name}:`, error.message);
      // Return empty status on error
      return {
        isOk: false,
        data: { users: [] }
      };
    }
  }

  // ================ SERVICE CREATION (MULTI-SERVER) ================

  async createService(params: ServiceCreateParams, isTestService: boolean): Promise<{
    success: boolean;
    links?: VlessLinkSet;
    message?: string;
    server?: Server;
  }> {
    try {
      console.log(`🚀 Creating service for user ${params.userEmail}...`);

      if (isTestService) {
        // enable this and you will be retrived only the servers that are 
        // meant for test servers 
        // use selectOptimalServer for not having this feature enabled
        // const server = await this.selectOptimalTestServer();
        const server = await this.selectOptimalServer();

      }
      else {
        const server = await this.selectOptimalServer();

      }
      // 1. Select optimal server with capacity
      const server = await this.selectOptimalServer();

      // 2. Get current config from selected server
      const config = await this.getConfig(server);

      // 3. Find VLESS inbound
      const vlessInbound = config.inbounds.find(inbound =>
        inbound.protocol === 'vless'
      );

      if (!vlessInbound) {
        throw new Error('No VLESS inbound found in configuration');
      }

      // Initialize clients array
      if (!vlessInbound.settings.clients) {
        vlessInbound.settings.clients = [];
      }

      // 4. Generate UUID and calculate expiry
      const uuid = uuidv4();
      const oneHourMs = 5 * 60 * 1000;

      const expireTestTime = oneHourMs + Date.now();

      const expireTime = Date.now() + (params.durationDays * 24 * 60 * 60 * 1000);


      const createdAt = new Date().toISOString();

      // 5. Create new client
      const newClient: Client = {
        id: uuid,
        email: params.userEmail,
        flow: '',
        limitIp: 0,
        totalGB: params.dataLimitGB?.toString(),
        // expireTime: expireTime
        expireTime: isTestService ? expireTestTime : expireTime,
        createdAt: createdAt
      };

      // 6. Add client to config
      vlessInbound.settings.clients.push(newClient);

      // 7. Update config on server
      await this.updateConfig(server, config);

      // 8. Restart service (don't throw on failure)
      await this.restartService(server);

      // 9. Generate VLESS links for all platforms
      const links = this.generateVlessLinks(server, vlessInbound, newClient);
      const linksList = links.android + ',' + links.ios + ',' + links.linux + ',' + links.macos + ',' + links.standard + ',' + links.windows;

      // 10. Increment server user count
      await db.incrementServerUsers(server.id);

      // 11. Store in database with server reference
      await this.storeUserConfigInDatabase(params, linksList, newClient, vlessInbound, server);

      console.log(`✅ Service created for user ${params.userEmail} on server ${server.name}`);
      console.log(`📊 Server ${server.name} now has ${server.current_users + 1}/${server.max_users} users`);

      return {
        success: true,
        links: links,
        message: `Service created successfully on ${server.name}`,
        server: server
      };

    } catch (error: any) {
      console.error('❌ Error creating V2Ray service:', error.message);
      return {
        success: false,
        message: `Failed to create service: ${error.message}`
      };
    }
  }


  private async storeUserConfigInDatabase(
    params: ServiceCreateParams,
    vlessLink: string,
    client: Client,
    inbound: any,
    server: Server
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + params.durationDays);

      await db.query(
        `INSERT INTO user_configs (
          user_id, service_id, server_id, vless_link, status, expires_at,
          data_used_gb, client_email, inbound_tag, data_limit_gb
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          params.userId,
          params.serviceId,
          server.id,
          vlessLink,
          'active',
          expiresAt,
          0.00,
          client.email,
          inbound.tag || 'vless-reality-inbound',
          params.dataLimitGB
        ]
      );

      console.log(`✅ User config stored in database for server ${server.name}`);
    } catch (error: any) {
      console.error('❌ Error storing user config in database:', error.message);
      throw error;
    }
  }

  private generateVlessLinks(server: Server, inbound: any, client: Client): VlessLinkSet {
    const serverHost = server.domain;
    const serverPort = server.xray_port || 8445;

    const streamSettings = inbound.streamSettings;
    const security = streamSettings?.security || 'none';
    const networkType = streamSettings?.network || 'tcp';

    let sni = '';
    let publicKey = process.env.REALITY_PUBLIC_KEY;
    let shortId = '';

    if (security === 'reality' && streamSettings?.realitySettings) {
      const reality = streamSettings.realitySettings;
      sni = reality.serverNames?.[0] || 'play.google.com';
      shortId = reality.shortIds?.[0] || '';
    }

    const linkParams: VlessLinkParams = {
      uuid: client.id,
      serverHost,
      serverPort,
      email: client.email,
      security,
      sni,
      publicKey,
      shortId,
      networkType,
      flow: client.flow || '',
      encryption: inbound.settings.decryption || 'none'
    };

    return VlessLinkGenerator.generateLinkSet(linkParams);
  }

  // ================ SERVICE REMOVAL ================

  async removeUserFromConfig(userEmail: string, serverId: number): Promise<boolean> {
    try {
      const server = await db.getServerById(serverId);
      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }

      const config = await this.getConfig(server);

      const vlessInbound = config.inbounds.find(inbound =>
        inbound.protocol === 'vless'
      );

      if (!vlessInbound || !vlessInbound.settings.clients) {
        throw new Error('No VLESS inbound found in configuration');
      }

      const initialCount = vlessInbound.settings.clients.length;
      vlessInbound.settings.clients = vlessInbound.settings.clients.filter(
        (client: Client) => client.email !== userEmail
      );

      if (vlessInbound.settings.clients.length === initialCount) {
        console.log(`User ${userEmail} not found in config on server ${server.name}`);
        return false;
      }

      await this.updateConfig(server, config);
      await this.restartService(server);

      // Decrement server user count
      await db.decrementServerUsers(server.id);

      console.log(`✅ User ${userEmail} removed from server ${server.name}`);
      return true;
    } catch (error: any) {
      console.error('Error removing user from config:', error.message);
      throw error;
    }
  }

  // ================ MULTI-SERVER MONITORING ================

  startMonitoring(): void {
    if (this.isMonitoringActive) {
      console.log('Monitoring already active');
      return;
    }

    console.log('⏰ Starting multi-server monitoring (every 5 minutes)...');

    cron.schedule('*/1 * * * *', async () => {
      console.log('🔄 Running multi-server monitor...');
      await this.checkAllServers();
    });

    this.isMonitoringActive = true;
    console.log('✅ Multi-server monitoring started');
  }

  private async checkAllServers(): Promise<void> {
    try {
      const servers = await db.getAllActiveServers();
      console.log(`🔍 Checking ${servers.length} active servers...`);

      for (const server of servers) {
        await this.checkServer(server);
      }

      // Update server statistics
      await this.updateServerStatistics();

      console.log('✅ Multi-server monitoring completed');
    } catch (error: any) {
      console.error('❌ Multi-server monitoring error:', error.message);
    }
  }

  private async checkServer(server: Server): Promise<void> {
    try {
      console.log(`🔍 Checking server ${server.name} (${server.ip})...`);

      // Get status and update user counts
      const status = await this.getStatus(server);

      // Update server user count based on actual config
      let userCount = 0;
      if (status.isOk && status.data && status.data.users) {
        userCount = status.data.users.length;
      } else {
        // Try to get config as fallback
        try {
          const config = await this.getConfig(server);
          const vlessInbound = config.inbounds.find(i => i.protocol === 'vless');
          if (vlessInbound && vlessInbound.settings.clients) {
            userCount = vlessInbound.settings.clients.length;
          }
        } catch (configError) {
          console.error(`⚠️ Could not get config from server ${server.name}`);
        }
      }

      // Update server user count in database
      await db.updateServerCurrentUsers(server.id, userCount);

      // Check bandwidth usage for users on this server
      if (status.isOk && status.data && status.data.users) {
        await this.checkServerBandwidth(server, status.data.users);
      }

      console.log(`✅ Server ${server.name}: ${userCount}/${server.max_users} users`);
    } catch (error: any) {
      console.error(`❌ Error checking server ${server.name}:`, error.message);

      // Mark server as offline if multiple failures
      // You might want to implement a failure counter
    }
  }

  private async checkServerBandwidth(server: Server, users: UserBandwidth[]): Promise<void> {
    try {
      const bandwidthMap = new Map<string, UserBandwidth>();
      users.forEach(user => {
        bandwidthMap.set(user.username, user);
      });

      // Get all active services on this server
      const activeServices = await this.getActiveServicesOnServer(server.id);

      for (const service of activeServices) {
        await this.checkServiceBandwidth(service, bandwidthMap);
      }
    } catch (error: any) {
      console.error(`Error checking bandwidth on server ${server.name}:`, error.message);
    }
  }

  private async getActiveServicesOnServer(serverId: number): Promise<any[]> {
    try {
      const result = await db.query(
        `SELECT 
          uc.*, 
          u.telegram_id, 
          u.username as telegram_username,
          s.name as service_name
        FROM user_configs uc
        JOIN users u ON uc.user_id = u.id
        LEFT JOIN services s ON uc.service_id = s.id
        WHERE uc.server_id = $1 AND uc.status IN ('active', 'test')`,
        [serverId]
      );
      return result.rows;
    } catch (error: any) {
      console.error('Error fetching active services:', error.message);
      return [];
    }
  }

  private async checkServiceBandwidth(service: any, bandwidthMap: Map<string, UserBandwidth>): Promise<void> {
    try {
      const userEmail = service.client_email;
      const bandwidth = bandwidthMap.get(userEmail);

      if (bandwidth) {
        const usedGB = (bandwidth.uplink + bandwidth.downlink) / 1073741824;
        const totalGB = service.data_limit_gb;

        // Update usage in database
        await db.query(
          'UPDATE user_configs SET data_used_gb = $1, updated_at = NOW() WHERE id = $2',
          [usedGB, service.id]
        );

        // Check if data limit reached
        if (totalGB && usedGB >= totalGB) {
          console.log(`⚠️ Data limit reached for user ${service.user_id} on server ${service.server_id}`);
          await this.handleDataLimitReached(service);
        }
      }


      // Check if expired
      const now = new Date();
      const expiresAt = new Date(service.expires_at);
      if (expiresAt < now) {
        console.log(`⚠️ Service expired for user ${service.user_id} on server ${service.server_id}`);
        await this.handleServiceExpired(service);
      }
    } catch (error: any) {
      console.error(`Error checking service ${service.id}:`, error.message);
    }
  }

  private async handleDataLimitReached(service: any): Promise<void> {
    try {
      await this.removeUserFromConfig(service.client_email, service.server_id);

      await db.query(
        'UPDATE user_configs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['suspended', service.id]
      );

      await this.notifyUser(
        service.telegram_id,
        `⚠️ *محدودیت داده به پایان رسید*\n\n` +
        ` V2Ray شما در سرور به حد مجاز مصرف داده رسید\n` +
        `⏸️ سرویس شما به حالت تعلیق درآمده است`
      );

    } catch (error: any) {
      console.error('Error handling data limit reached:', error.message);
    }
  }

  private async handleServiceExpired(service: any): Promise<void> {
    try {
      await this.removeUserFromConfig(service.client_email, service.server_id);

      await db.query(
        'UPDATE user_configs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['expired', service.id]
      );

      await this.notifyUser(
        service.telegram_id,
        `⏰ *سرویس منقضی شد*\n\n` +
        `سرویس V2Ray شما در سرور ${service.server_name} منقضی شده است\n\n` +
        `❌ سرویس شما غیرفعال شده است`
      );

    } catch (error: any) {
      console.error('Error handling service expiry:', error.message);
    }
  }

  private async updateServerStatistics(): Promise<void> {
    try {
      const stats = await db.getServerStats();
      console.log(`📊 Server Fleet Statistics:`);
      console.log(`   • Total Servers: ${stats.total_servers}`);
      console.log(`   • Active Servers: ${stats.active_servers}`);
      console.log(`   • Total Users: ${stats.total_users}`);
      console.log(`   • Total Capacity: ${stats.total_capacity}`);
      console.log(`   • Utilization: ${Math.round((stats.total_users / stats.total_capacity) * 100)}%`);
    } catch (error: any) {
      console.error('Error updating server statistics:', error.message);
    }
  }

  private async notifyUser(telegramId: number, message: string): Promise<void> {
    if (!this.botService) {
      console.warn('Bot service not set, cannot notify user');
      return;
    }

    try {
      await this.botService.sendNotification(telegramId, message);
    } catch (error: any) {
      console.error('Error notifying user:', error.message);
    }
  }

  // ================ ADMIN METHODS ================

  async getServerStatus(): Promise<any> {
    const result = await db.query(
      `SELECT 
        id, name, location, domain, ip,
        current_users, max_users,
        (max_users - current_users) as available_slots,
        status, last_checked_at
      FROM servers 
      WHERE is_active = true
      ORDER BY location, name`,
      []
    );
    return result.rows;
  }

  async addServer(serverData: Partial<Server>): Promise<Server> {
    const result = await db.query(
      `INSERT INTO servers (
        name, domain, ip, api_port, api_token, 
        max_users, location, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        serverData.name,
        serverData.domain,
        serverData.ip,
        serverData.api_port || 5000,
        serverData.api_token,
        serverData.max_users || 100,
        serverData.location,
        serverData.status || 'active'
      ]
    );
    return result.rows[0];
  }

  async updateServer(serverId: number, serverData: Partial<Server>): Promise<Server> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(serverData).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    updates.push(`updated_at = NOW()`);
    values.push(serverId);

    const result = await db.query(
      `UPDATE servers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }
}

export default new V2RayService();
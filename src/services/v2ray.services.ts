import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import db from '../database/database.service';
import { BotService } from '../bot/bot.services';
import crypto from 'crypto';

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

const MAX_DELTA_PER_MINUTE_GB = 1; // no user can use more than 1GB/min realistically

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

  async selectAllServers(): Promise<Server[]> {
    console.log('🖥️ Selecting optimal server for new user...');

    const availableServers = await db.getAvailableServers();

    if (availableServers.length === 0) {
      throw new Error('No available servers with capacity');
    }

    // Select server with least current users (load balancing)
    // const selectedServer = availableServers[0];

    // console.log(`✅ Selected server: ${selectedServer.name} (${selectedServer.location})`);
    // console.log(`📊 Current usage: ${selectedServer.current_users}/${selectedServer.max_users} users`);

    return availableServers;
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

  async createService(params: ServiceCreateParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      console.log(`🚀 Creating service for user ${params.userEmail}...`);

      const servers = await this.selectAllServers();
      if (servers.length === 0) throw new Error('No active servers available');

      // Generate ONE uuid for this user — same identity across all servers
      const uuid = uuidv4();
      const expireTime = Date.now() + (params.durationDays * 24 * 60 * 60 * 1000);
      const createdAt = new Date().toISOString();

      const newClient: Client = {
        id: uuid,
        email: params.userEmail,
        flow: '',
        limitIp: 0,
        totalGB: params.dataLimitGB?.toString(),
        expireTime: expireTime,
        createdAt: createdAt
      };

      // Deploy to all servers concurrently and collect their links
      const links = await Promise.all(servers.map(async server => {
        const config = await this.getConfig(server);

        config.inbounds[0].settings.clients?.push(newClient);

        await this.updateConfig(server, config);
        await this.restartService(server);
        await db.incrementServerUsers(server.id);

        // Build this server's link correctly
        const link = server.config_format
          .replace('USER_UUID', uuid)
          .replace('USER_EMAIL', params.configName);

        console.log(`✅ Service created for user ${params.configName} on server ${server.name}`);
        return link;
      }));

      const linksList = links.join(',');

      // Store ONE user_config row for this subscription
      await this.storeUserConfigInDatabase(params, linksList, newClient);

      return {
        success: true,
        message: `Service created successfully on ${servers.length} servers`,
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
  server?: Server
): Promise<void> {
  try {
    const expiresAt = new Date(client.expireTime!);
    const subId = params.configName + crypto.randomBytes(4).toString('hex');

    await db.query(
      `INSERT INTO user_configs (
        user_id, service_id, vless_link, status, expires_at,
        data_used_gb, client_email, inbound_tag, data_limit_gb,
        config_name, user_uuid, sub_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        params.userId,
        params.serviceId,
        vlessLink,
        'active',
        expiresAt,
        0.00,
        client.email,
        'vless-reality-inbound',
        params.dataLimitGB,
        params.configName,
        client.id,
        subId
      ]
    );
    console.log(`✅ User config stored in database`);
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

  async removeUserFromAllServers(userEmail: string): Promise<boolean> {
    try {
      const servers = await db.getAllActiveServers();
      if (servers.length === 0) throw new Error('No active servers found');

      const results = await Promise.all(servers.map(async server => {
        try {
          const config = await this.getConfig(server);
          const initialCount = config.inbounds[0].settings.clients?.length;

          config.inbounds[0].settings.clients = config.inbounds[0].settings.clients?.filter(
            (client: Client) => client.email !== userEmail
          );

          if (config.inbounds[0].settings.clients?.length === initialCount) {
            console.log(`User ${userEmail} not found in config on server ${server.name}`);
            return false;
          }

          await this.updateConfig(server, config);
          await this.restartService(server);
          await db.decrementServerUsers(server.id);

          console.log(`✅ User ${userEmail} removed from server ${server.name}`);
          return true;

        } catch (error: any) {
          // Don't let one server failure block removal from other servers
          console.error(`❌ Failed to remove ${userEmail} from server ${server.name}:`, error.message);
          return false;
        }
      }));

      // Return true if removed from at least one server
      const anySuccess = results.some(r => r === true);
      if (!anySuccess) {
        console.warn(`⚠️ User ${userEmail} was not found or removed from any server`);
      }
      return anySuccess;

    } catch (error: any) {
      console.error('Error removing user from all servers:', error.message);
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

      await Promise.all(servers.map(s => this.checkServer(s)));

      // Update server statistics
      await this.updateServerStatistics();

      console.log('✅ Multi-server monitoring completed');
    } catch (error: any) {
      console.error('❌ Multi-server monitoring error:', error.message);
    }
  }

  // bug: it counts the number of users nbased on the response from getStatus
  // which is reset after each system restart
  // it needs to use the getConfig() method, to get all the users count

  private async checkServer(server: Server): Promise<void> {
    try {
      console.log(`🔍 Checking server ${server.name} (${server.ip})...`);

      // Get status and update user counts
      const status = await this.getStatus(server);

      // Update server user count based on actual config
      let userCount = 0;
      try {
        const config = await this.getConfig(server);
        userCount = config.inbounds[0].settings.clients?.length || 0;
      } catch (configError) {
        console.error(`⚠️ Could not get config from server ${server.name}`);
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
      const activeUserConfigs = await this.getAllActiveServices();

      for (const config of activeUserConfigs) {
        await this.checkServiceBandwidth(config, bandwidthMap, server.id);
      }
    } catch (error: any) {
      console.error(`Error checking bandwidth on server ${server.name}:`, error.message);
    }
  }

  private async getAllActiveServices(): Promise<any[]> {
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
        WHERE uc.status IN ('active', 'test')`,

      );
      return result.rows;
    } catch (error: any) {
      console.error('Error fetching active services:', error.message);
      return [];
    }
  }

  private async checkServiceBandwidth(
    service: any,
    bandwidthMap: Map<string, UserBandwidth>,
    serverId: number
  ): Promise<void> {
    try {
      const userEmail = service.client_email;
      const bandwidth = bandwidthMap.get(userEmail);
      if (!bandwidth) {

        if (new Date(service.expires_at) < new Date()) {
          await this.handleServiceExpired(service);
        }
        return
      };

      const currentSessionGB = (bandwidth.uplink + bandwidth.downlink) / 1073741824;

      // Look up last known session for this specific user+server pair
      // const sessionResult = await db.query(
      //   `SELECT last_session_gb FROM user_server_sessions
      //  WHERE user_config_id = $1 AND server_id = $2`,
      //   [service.id, serverId]
      // );
      const sessionResult = await db.query(
  `SELECT last_session_gb FROM user_server_sessions
   WHERE user_config_id = $1 AND server_id = $2`,
  [service.id, serverId]
);

      // if (sessionResult.rowCount === 0) {
      //   console.warn(`Service config not found for id ${service.id}`);
      //   return;
      // }

      // const lastSessionGB = sessionResult.rowCount! > 0
      //   ? parseFloat(sessionResult.rows[0].last_session_gb) || 0
      //   : 0;
      const lastSessionGB = sessionResult.rowCount! > 0
  ? parseFloat(sessionResult.rows[0].last_session_gb) || 0
  : 0;



      const RESTART_THRESHOLD_GB = 0.01;
      const dropped = lastSessionGB - currentSessionGB;
      const isRestart = dropped > RESTART_THRESHOLD_GB;

      const deltaGB = isRestart
        ? currentSessionGB
        : Math.max(0, currentSessionGB - lastSessionGB);

      // Always update the per-server session tracker regardless of delta
      // await db.query(
      //   `INSERT INTO user_server_sessions (user_config_id, server_id, last_session_gb, updated_at)
      //  VALUES ($1, $2, $3, NOW())
      //  ON CONFLICT (user_config_id, server_id)
      //  DO UPDATE SET last_session_gb = $3, updated_at = NOW()`,
      //   [service.id, serverId, currentSessionGB]
      // );
      // This upsert will now run on first visit too, creating the row
await db.query(
  `INSERT INTO user_server_sessions (user_config_id, server_id, last_session_gb, updated_at)
   VALUES ($1, $2, $3, NOW())
   ON CONFLICT (user_config_id, server_id)
   DO UPDATE SET last_session_gb = $3, updated_at = NOW()`,
  [service.id, serverId, currentSessionGB]
);

      if (deltaGB === 0) return;

      if (deltaGB > MAX_DELTA_PER_MINUTE_GB) {
        console.error(
          `Suspicious delta for ${userEmail} on server ${serverId}: ` +
          `deltaGB=${deltaGB}, currentSessionGB=${currentSessionGB}, ` +
          `lastSessionGB=${lastSessionGB} — skipping update`
        );
        return;
      }


      // Atomically add this server's delta to the user's running total
      const updateResult = await db.query(
        `UPDATE user_configs
       SET data_used_gb = data_used_gb + $1,
           updated_at   = NOW()
       WHERE id = $2
       RETURNING data_used_gb`,
        [deltaGB, service.id]
      );

      const newTotalGB = parseFloat(updateResult.rows[0].data_used_gb);

      console.log(
        `\nfor user ${userEmail} on server ${serverId}:` +
        `\nDelta: ${deltaGB}` +
        `\ncurrentSession: ${currentSessionGB}` +
        `\nlastSession: ${lastSessionGB}` +
        `\ntotalUsed: ${newTotalGB}`
      );

      if (service.data_limit_gb && newTotalGB >= service.data_limit_gb) {
        await this.handleDataLimitReached(service);
      }

      if (new Date(service.expires_at) < new Date()) {
        await this.handleServiceExpired(service);
      }

    } catch (error: any) {
      console.error(`Error checking service ${service.id}:`, error.message);
    }
  }

  private async handleDataLimitReached(service: any): Promise<void> {
    try {
      await this.removeUserFromAllServers(service.client_email);

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
      await this.removeUserFromAllServers(service.client_email);

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
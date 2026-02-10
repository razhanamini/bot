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
  ServiceMonitorResult 
} from '../types/v2ray.type';
import { VlessLinkGenerator, VlessLinkParams, VlessLinkSet } from '../types/v2ray.links';

dotenv.config();

export class V2RayService {
  private http: AxiosInstance;
  private botService: BotService | null = null;
  private isMonitoringActive: boolean = false;

  constructor() {
    const apiToken = process.env.XRAY_API_TOKEN;
    const baseURL = process.env.XRAY_API_URL || 'http://172.86.95.72:5000';

    if (!apiToken) {
      throw new Error('XRAY_API_TOKEN is not defined in environment variables');
    }

    this.http = axios.create({
      baseURL,
      headers: {
        'x-api-token': apiToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Initialize monitoring if enabled
    if (process.env.ENABLE_XRAY_MONITORING === 'true') {
      this.startMonitoring();
    }
  }

  setBotService(botService: BotService) {
    this.botService = botService;
  }

  // ================ API METHODS ================

  /**
   * Get current Xray configuration from server
   * Response: { success: true, config: {...} }
   */
  async getConfig(): Promise<V2RayConfig> {
    try {
      console.log('📡 Fetching Xray config from server...');
      const response = await this.http.get('/api/xray/config');
      
      // Validate response structure
      if (!response.data.success) {
        throw new Error('API returned success: false');
      }
      
      if (!response.data.config) {
        throw new Error('No config in response');
      }
      
      console.log('✅ Config fetched successfully');
      return response.data.config;
    } catch (error: any) {
      console.error('❌ Error fetching Xray config:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to get Xray config: ${error.message}`);
    }
  }


  private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

  /**
   * Update Xray configuration on server
   * Request: { config: {...} }
   * Response: { success: true, message: "...", backup: "..." }
   */
  async updateConfig(config: V2RayConfig): Promise<boolean> {
    try {
      console.log('📤 Updating Xray config...');
      
      // Prepare request body matching API expectation
      const requestBody = { config };
      
      const response = await this.http.put('/api/xray/config', requestBody);
      
      // Validate response
      if (!response.data.success) {
        throw new Error(`Update failed: ${response.data.message || 'Unknown error'}`);
      }
      
      console.log(`✅ Xray config updated: ${response.data.message}`);
      console.log(`📁 Backup created at: ${response.data.backup}`);
      return true;
    } catch (error: any) {
      console.error('❌ Error updating Xray config:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to update Xray config: ${error.message}`);
    }
  }

  /**
   * Restart Xray service
   * Response: { success: true, message: "...", output: "" }
   */
  async restartService(maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [Attempt ${attempt}/${maxRetries}] Requesting Xray service restart...`);
      
      const response = await this.http.post('/api/xray/restart', {}, {
        timeout: 10000 // 10 second timeout per request
      });
      
      if (response.data.success) {
        console.log(`✅ Xray service restarted: ${response.data.message}`);
        return true;
      }
      
      console.error(`❌ Attempt ${attempt} failed: ${response.data.message}`);
      
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} error: ${error.message}`);
    }
    
    // If not the last attempt, wait before retrying
    if (attempt < maxRetries) {
      const delay = 2000 * attempt; // 2s, 4s, 6s, etc.
      console.log(`⏳ Waiting ${delay}ms before next attempt...`);
      await this.sleep(delay);
    }
  }
  
  throw new Error(`Failed to restart Xray service after ${maxRetries} attempts`);
}

  /**
   * Get Xray status and bandwidth usage
   * Response: { success: true, data: "stringified JSON" }
   * Stringified JSON: { isOk: true, data: { users: [...] } }
   */
  async getStatus(): Promise<XrayStatusData> {
    try {
      console.log('📡 Fetching Xray status...');
      const response = await this.http.get('/api/xray/status');
      
      // Validate response
      if (!response.data.success) {
        throw new Error('API returned success: false');
      }
      
      if (!response.data.data) {
        throw new Error('No data in response');
      }
      
      // Parse the stringified JSON
      let parsedData: any;
      if (typeof response.data.data === 'string') {
        try {
          parsedData = JSON.parse(response.data.data);
        } catch (parseError: any) {
          throw new Error(`Failed to parse status data: ${parseError.message}`);
        }
      } else {
        parsedData = response.data.data;
      }
      
      // Validate parsed data structure
      if (!parsedData.isOk) {
        throw new Error('Xray status is not OK');
      }
      
      // Ensure users array exists
      if (!parsedData.data) {
        parsedData.data = {};
      }
      if (!parsedData.data.users) {
        parsedData.data.users = [];
      }
      
      console.log(`✅ Status fetched. Users: ${parsedData.data.users.length}`);
      return parsedData;
    } catch (error: any) {
      console.error('❌ Error fetching Xray status:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw new Error(`Failed to get Xray status: ${error.message}`);
    }
  }

  // ================ SERVICE CREATION ================

  /**
   * Create a new V2Ray service for a user
   */
  async createService(params: ServiceCreateParams): Promise<{
    success: boolean;
    links?: VlessLinkSet;
    message?: string;
  }> {
    try {
      console.log(`🚀 Creating service for user ${params.userEmail}...`);
      
      // 1. Get current config
      const config = await this.getConfig();
      
      // 2. Find VLESS inbound
      const vlessInbound = config.inbounds.find(inbound => 
        inbound.protocol === 'vless'
      );

      if (!vlessInbound) {
        throw new Error('No VLESS inbound found in configuration');
      }

      // Initialize clients array if it doesn't exist
      if (!vlessInbound.settings.clients) {
        vlessInbound.settings.clients = [];
      }

      // 3. Generate UUID and calculate expiry
      const uuid = uuidv4();
      const expireTime = Date.now() + (params.durationDays * 24 * 60 * 60 * 1000);
      const createdAt = new Date().toISOString();
      
      // 4. Create new client
      const newClient: Client = {
        id: uuid,
        email: params.userEmail,
        flow: '',
        limitIp: 0,
        totalGB: params.dataLimitGB,
        expireTime: expireTime,
        createdAt: createdAt
      };

      // 5. Add client to config
      vlessInbound.settings.clients.push(newClient);
      
      // 6. Update config on server
      await this.updateConfig(config);
      
      // 7. Restart service to apply changes
      await this.restartService();
      
      // 8. Generate VLESS links for all platforms
      const links = this.generateVlessLinks(vlessInbound, newClient);
      
      // 9. Store in database with additional fields
      await this.storeUserConfigInDatabase(params, links.standard, newClient, vlessInbound);

      console.log(`✅ Service created for user ${params.userEmail} (ID: ${params.userId})`);
      
      return {
        success: true,
        links: links,
        message: 'Service created successfully'
      };

    } catch (error: any) {
      console.error('❌ Error creating V2Ray service:', error.message);
      return {
        success: false,
        message: `Failed to create service: ${error.message}`
      };
    }
  }

  /**
   * Store user config in database with all required fields
   */
  private async storeUserConfigInDatabase(
    params: ServiceCreateParams,
    vlessLink: string,
    client: Client,
    inbound: any
  ): Promise<void> {
    try {
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + params.durationDays);
      
      // Insert with all required fields
      await db.query(
        `INSERT INTO user_configs (
          user_id, service_id, vless_link, status, expires_at,
          data_used_gb, client_email, inbound_tag, data_limit_gb
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          params.userId,
          params.serviceId,
          vlessLink,
          'active',
          expiresAt,
          0.00, // initial data used
          client.email,
          inbound.tag || 'vless-reality-inbound',
          params.dataLimitGB
        ]
      );
      
      console.log('✅ User config stored in database');
    } catch (error: any) {
      console.error('❌ Error storing user config in database:', error.message);
      throw error;
    }
  }

  /**
   * Generate VLESS link from inbound and client
   */
  private generateVlessLinks(inbound: any, client: Client): VlessLinkSet {
    const serverHost = process.env.XRAY_SERVER_HOST || inbound.serverHost || 'your-server.com';
    const serverPort = parseInt(process.env.XRAY_SERVER_PORT || inbound.port || '8445');
    
    const streamSettings = inbound.streamSettings;
    const security = streamSettings?.security || 'none';
    const networkType = streamSettings?.network || 'tcp';
    
    // Get reality settings from config or environment
    let sni = '';
    let publicKey = '';
    let shortId = '';
    
    if (security === 'reality' && streamSettings?.realitySettings) {
      const reality = streamSettings.realitySettings;
      sni = reality.serverNames?.[0] || process.env.REALITY_SNI || 'play.google.com';
      publicKey = reality.publicKey || process.env.REALITY_PUBLIC_KEY || '';
      shortId = reality.shortIds?.[0] || process.env.REALITY_SHORT_ID || '';
    } else {
      // Fallback to environment variables
      sni = process.env.REALITY_SNI || 'play.google.com';
      publicKey = process.env.REALITY_PUBLIC_KEY || '';
      shortId = process.env.REALITY_SHORT_ID || '';
    }
    
    // Prepare parameters for link generation
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

  // ================ SERVICE MONITORING ================

  /**
   * Start monitoring service (cron job)
   */
  startMonitoring(): void {
    if (this.isMonitoringActive) {
      console.log('Monitoring already active');
      return;
    }

    // Run every 60 minutes
    cron.schedule('*/1 * * * *', async () => {
      console.log('🔄 Running Xray service monitor...');
      await this.checkAndUpdateServices();
    });

    this.isMonitoringActive = true;
    console.log('✅ Xray service monitoring started (every 60 minutes)');
  }

  /**
   * Check and update services based on bandwidth and expiry
   */
  async checkAndUpdateServices(): Promise<void> {
    try {
      // 1. Get bandwidth usage from Xray
      const status = await this.getStatus();
      
      if (!status.isOk) {
        console.error('Xray status not OK');
        return;
      }

      const bandwidthMap = new Map<string, UserBandwidth>();
      status.data.users.forEach((user: UserBandwidth) => {
        bandwidthMap.set(user.username, user);
      });

      // 2. Get all active services from database
      const activeServices = await this.getActiveServices();
      
      // 3. Check each service
      for (const service of activeServices) {
        await this.checkService(service, bandwidthMap);
      }

      console.log('✅ Service monitoring completed');
    } catch (error: any) {
      console.error('Error in service monitoring:', error.message);
    }
  }

  /**
   * Get all active services from database
   */
  private async getActiveServices(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          uc.*, 
          u.telegram_id, 
          u.username as telegram_username,
          s.name as service_name
        FROM user_configs uc
        JOIN users u ON uc.user_id = u.id
        LEFT JOIN services s ON uc.service_id = s.id
        WHERE uc.status = 'active'
      `);
      return result.rows;
    } catch (error: any) {
      console.error('Error fetching active services:', error.message);
      return [];
    }
  }

  /**
   * Check individual service
   */
  private async checkService(service: any, bandwidthMap: Map<string, UserBandwidth>): Promise<void> {
    try {
      const result = await this.analyzeService(service, bandwidthMap);
      
      if (result.isDataLimitReached) {
        console.log(`⚠️ Data limit reached for user ${service.user_id} (${result.userEmail})`);
        await this.handleDataLimitReached(service, result);
      }
      
      if (result.isExpired) {
        console.log(`⚠️ Service expired for user ${service.user_id} (${result.userEmail})`);
        await this.handleServiceExpired(service, result);
      }
      
      // Update usage in database
      await this.updateServiceUsage(service.id, result.usedGB);
      
    } catch (error: any) {
      console.error(`Error checking service ${service.id}:`, error.message);
    }
  }

  /**
   * Analyze service status
   */
  private analyzeService(service: any, bandwidthMap: Map<string, UserBandwidth>): ServiceMonitorResult {
    const userEmail = service.client_email || `user_${service.user_id}@service.com`;
    const bandwidth = bandwidthMap.get(userEmail);
    
    // Convert bytes to GB (1 GB = 1,073,741,824 bytes)
    const usedBytes = bandwidth ? (bandwidth.uplink + bandwidth.downlink) : 0;
    const usedGB = usedBytes / 1073741824;
    
    const totalGB = service.data_limit_gb;
    const isDataLimitReached = totalGB ? usedGB >= totalGB : false;
    
    const now = new Date();
    const expiresAt = new Date(service.expires_at);
    const isExpired = expiresAt < now;
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      userId: service.user_id,
      userEmail: userEmail,
      serviceId: service.service_id,
      usedGB: parseFloat(usedGB.toFixed(2)),
      totalGB: totalGB,
      isDataLimitReached,
      isExpired,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0
    };
  }

  /**
   * Update service usage in database
   */
  private async updateServiceUsage(configId: number, usedGB: number): Promise<void> {
    try {
      await db.query(
        'UPDATE user_configs SET data_used_gb = $1, updated_at = NOW() WHERE id = $2',
        [usedGB, configId]
      );
    } catch (error: any) {
      console.error('Error updating service usage:', error.message);
    }
  }

  // ================ SERVICE MANAGEMENT ================

  /**
   * Handle data limit reached
   */
  private async handleDataLimitReached(service: any, result: ServiceMonitorResult): Promise<void> {
    try {
      // 1. Remove user from Xray config
      await this.removeUserFromConfig(service.client_email);
      
      // 2. Update database status
      await db.query(
        'UPDATE user_configs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['suspended', service.id]
      );
      
      // 3. Notify user via bot
      await this.notifyUser(
        service.telegram_id,
        `⚠️ *Data Limit Reached*\n\n` +
        `Your V2Ray service "${service.service_name}" has reached its data limit.\n` +
        `📊 *Usage:* ${result.usedGB.toFixed(2)} GB / ${result.totalGB} GB\n` +
        `\nService has been suspended.`
      );
      
      console.log(`✅ User ${result.userEmail} suspended due to data limit`);
    } catch (error: any) {
      console.error('Error handling data limit reached:', error.message);
    }
  }

  /**
   * Handle service expiry
   */
  private async handleServiceExpired(service: any, result: ServiceMonitorResult): Promise<void> {
    try {
      // 1. Remove user from Xray config
      await this.removeUserFromConfig(service.client_email);
      
      // 2. Update database status
      await db.query(
        'UPDATE user_configs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['expired', service.id]
      );
      
      // 3. Notify user via bot
      await this.notifyUser(
        service.telegram_id,
        `⏰ *Service Expired*\n\n` +
        `Your V2Ray service "${service.service_name}" has expired.\n` +
        `\nService has been deactivated.`
      );
      
      console.log(`✅ User ${result.userEmail} service expired`);
    } catch (error: any) {
      console.error('Error handling service expiry:', error.message);
    }
  }

  /**
   * Remove user from Xray config
   */
  async removeUserFromConfig(userEmail: string): Promise<boolean> {
    try {
      // 1. Get current config
      const config = await this.getConfig();
      
      // 2. Find VLESS inbound
      const vlessInbound = config.inbounds.find(inbound => 
        inbound.protocol === 'vless'
      );

      if (!vlessInbound || !vlessInbound.settings.clients) {
        throw new Error('No VLESS inbound found in configuration');
      }

      // 3. Remove user from clients
      const initialCount = vlessInbound.settings.clients.length;
      vlessInbound.settings.clients = vlessInbound.settings.clients.filter(
        (client: Client) => client.email !== userEmail
      );
      
      if (vlessInbound.settings.clients.length === initialCount) {
        console.log(`User ${userEmail} not found in config`);
        return false;
      }

      // 4. Update config on server
      await this.updateConfig(config);
      
      // 5. Restart service
      await this.restartService();
      
      console.log(`✅ User ${userEmail} removed from Xray config`);
      return true;
    } catch (error: any) {
      console.error('Error removing user from config:', error.message);
      throw error;
    }
  }

  /**
   * Notify user via Telegram bot
   */
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

  /**
   * Get user bandwidth usage
   */
  async getUserBandwidth(userEmail: string): Promise<{
    usedGB: number;
    totalGB?: number;
    percentage?: number;
  }> {
    try {
      const status = await this.getStatus();
      
      if (!status.isOk || !status.data?.users) {
        throw new Error('Invalid status response');
      }

      const user = status.data.users.find((u: UserBandwidth) => u.username === userEmail);
      if (!user) {
        return { usedGB: 0 };
      }

      const usedGB = (user.uplink + user.downlink) / 1073741824;
      
      // Get total limit from database
      const result = await db.query(
        'SELECT data_limit_gb FROM user_configs WHERE client_email = $1 AND status = $2',
        [userEmail, 'active']
      );
      
      const totalGB = result.rows[0]?.data_limit_gb;
      const percentage = totalGB ? (usedGB / totalGB) * 100 : undefined;

      return {
        usedGB: parseFloat(usedGB.toFixed(2)),
        totalGB: totalGB,
        percentage: percentage ? parseFloat(percentage.toFixed(1)) : undefined
      };
    } catch (error: any) {
      console.error('Error getting user bandwidth:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new V2RayService();
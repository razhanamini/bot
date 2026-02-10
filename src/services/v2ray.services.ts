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
   */
async getConfig(): Promise<V2RayConfig> {
  try {
    console.log('📡 Fetching Xray config from server...');
    const response = await this.http.get('/api/xray/config');
    
    // Debug log
    console.log('🔍 Response structure:', Object.keys(response.data));
    console.log('🔍 Has success key?', 'success' in response.data);
    console.log('🔍 Has config key?', 'config' in response.data);
    
    let configData: V2RayConfig;
    
    // Check if config is nested under 'config' property
    if (response.data.config) {
      console.log('✅ Config found in response.data.config');
      configData = response.data.config;
    } else if (response.data.inbounds) {
      // Fallback: config might be directly in response.data
      console.log('⚠️ Config found directly in response.data');
      configData = response.data;
    } else {
      console.error('❌ Unexpected response format:', response.data);
      throw new Error('Unexpected response format from Xray API');
    }
    
    // Validate the config structure
    if (!configData.inbounds) {
      console.error('❌ Config missing "inbounds":', configData);
      throw new Error('Config is missing "inbounds" property');
    }
    
    console.log(`✅ Config parsed successfully. Inbounds: ${configData.inbounds.length}`);
    
    return configData;
  } catch (error) {
    console.error('❌ Error fetching Xray config:', error);
    if (error) {
      console.error('Response status:', error);
      console.error('Response data:', error);
    }
    throw new Error(`Failed to get Xray config: ${error}`);
  }
}

  /**
   * Update Xray configuration on server
   */
  async updateConfig(config: V2RayConfig): Promise<boolean> {
    try {
      await this.http.put('/api/xray/config', config);
      console.log('✅ Xray config updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating Xray config:', error);
      throw new Error(`Failed to update Xray config: ${error}`);
    }
  }

  /**
   * Restart Xray service
   */
  async restartService(): Promise<boolean> {
    try {
      await this.http.post('/api/xray/status');
      console.log('✅ Xray service restart requested');
      return true;
    } catch (error) {
      console.error('Error restarting Xray service:', error);
      throw new Error(`Failed to restart Xray service: ${error}`);
    }
  }

  /**
   * Get Xray status and bandwidth usage
   */
  async getStatus(): Promise<XrayStatusData> {
    try {
      const response = await this.http.get<XrayStatusResponse>('/api/xray/status');
      
      if (typeof response.data.data === 'string') {
        // Parse the stringified JSON
        const parsedData = JSON.parse(response.data.data);
        return parsedData;
      } else {
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching Xray status:', error);
      throw new Error(`Failed to get Xray status: ${error}`);
    }
  }

  // ================ SERVICE CREATION ================

  /**
   * Create a new V2Ray service for a user
   */
  async createService(params: ServiceCreateParams): Promise<{
    success: boolean;
    vlessLink?: string;
    message?: string;
  }> {
    try {
      // 1. Get current config
      const config = await this.getConfig();
      
      // 2. Find VLESS inbound (usually the first one)
      const vlessInbound = config.inbounds.find(inbound => 
        inbound.protocol === 'vless' && inbound.tag.includes('reality')
      );

      if (!vlessInbound || !vlessInbound.settings.clients) {
        throw new Error('No VLESS inbound found in configuration');
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
      
      // 8. Generate VLESS link
      const vlessLink = this.generateVlessLink(config, vlessInbound, newClient);
      
      // 9. Store in database
      await db.createUserConfig(
        params.userId,
        params.serviceId,
        vlessLink,
        'active',
        params.durationDays
      );

      console.log(`✅ Service created for user ${params.userEmail} (ID: ${params.userId})`);
      
      return {
        success: true,
        vlessLink: vlessLink,
        message: 'Service created successfully'
      };

    } catch (error) {
      console.error('Error creating V2Ray service:', error);
      return {
        success: false,
        message: `Failed to create service: ${error}`
      };
    }
  }

  /**
   * Generate VLESS link from config and client
   */
  private generateVlessLink(config: V2RayConfig, inbound: any, client: Client): string {
    const serverHost = process.env.XRAY_SERVER_HOST || 'your-server.com';
    const port = inbound.port;
    const uuid = client.id;
    const email = encodeURIComponent(client.email);
    
    const streamSettings = inbound.streamSettings;
    const security = streamSettings?.security || 'none';
    const network = streamSettings?.network || 'tcp';
    
    let params = new URLSearchParams();
    
    if (security === 'reality' && streamSettings?.realitySettings) {
      const reality = streamSettings.realitySettings;
      params.set('type', network);
      params.set('security', security);
      params.set('sni', reality.serverNames?.[0] || '');
      params.set('pbk', reality.privateKey || '');
      params.set('sid', reality.shortIds?.[0] || '');
      params.set('fp', reality.fingerprint || 'chrome');
    } else if (security === 'tls') {
      params.set('security', security);
      params.set('sni', streamSettings?.tlsSettings?.serverName || '');
      params.set('fp', streamSettings?.tlsSettings?.fingerprint || '');
    }
    
    params.set('flow', client.flow || '');
    params.set('enc', inbound.settings.decryption || 'none');
    
    const query = params.toString();
    return `vless://${uuid}@${serverHost}:${port}?${query}#${email}`;
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
    cron.schedule('*/60 * * * *', async () => {
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
      
      if (!status.isOk || !status.data?.users) {
        console.error('Invalid status response from Xray');
        return;
      }

      const bandwidthMap = new Map<string, UserBandwidth>();
      status.data.users.forEach(user => {
        bandwidthMap.set(user.username, user);
      });

      // 2. Get all active services from database
      const activeServices = await this.getActiveServices();
      
      // 3. Check each service
      for (const service of activeServices) {
        await this.checkService(service, bandwidthMap);
      }

      console.log('✅ Service monitoring completed');
    } catch (error) {
      console.error('Error in service monitoring:', error);
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
          s.name as service_name,
          s.data_limit_gb
        FROM user_configs uc
        JOIN users u ON uc.user_id = u.id
        LEFT JOIN services s ON uc.service_id = s.id
        WHERE uc.status = 'active'
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching active services:', error);
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
      
    } catch (error) {
      console.error(`Error checking service ${service.id}:`, error);
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
    
    const totalGB = service.data_limit_gb || service.data_limit_gb;
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
    } catch (error) {
      console.error('Error updating service usage:', error);
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
        `⚠️ Your V2Ray service "${service.service_name}" has reached its data limit (${result.usedGB.toFixed(2)} GB used).\n\nService has been suspended.`
      );
      
      console.log(`✅ User ${result.userEmail} suspended due to data limit`);
    } catch (error) {
      console.error('Error handling data limit reached:', error);
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
        `⏰ Your V2Ray service "${service.service_name}" has expired.\n\nService has been deactivated.`
      );
      
      console.log(`✅ User ${result.userEmail} service expired`);
    } catch (error) {
      console.error('Error handling service expiry:', error);
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
        inbound.protocol === 'vless' && inbound.tag.includes('reality')
      );

      if (!vlessInbound || !vlessInbound.settings.clients) {
        throw new Error('No VLESS inbound found in configuration');
      }

      // 3. Remove user from clients
      const initialCount = vlessInbound.settings.clients.length;
      vlessInbound.settings.clients = vlessInbound.settings.clients.filter(
        client => client.email !== userEmail
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
    } catch (error) {
      console.error('Error removing user from config:', error);
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
    } catch (error) {
      console.error('Error notifying user:', error);
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

      const user = status.data.users.find(u => u.username === userEmail);
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
    } catch (error) {
      console.error('Error getting user bandwidth:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new V2RayService();
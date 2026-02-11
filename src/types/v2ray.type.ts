// V2Ray/XRay Configuration Interfaces
export interface V2RayConfig {
  log: LogConfig;
  api?: ApiConfig;
  stats?: StatsConfig;
  policy: PolicyConfig;
  inbounds: Inbound[];
  outbounds: Outbound[];
  routing: RoutingConfig;
}

export interface LogConfig {
  loglevel: 'debug' | 'info' | 'warning' | 'error' | 'none';
}

export interface ApiConfig {
  tag: string;
  services: string[];
}

export interface StatsConfig {
  enabled: boolean;
  statsFile?: string;
}

export interface PolicyConfig {
  levels: Record<string, PolicyLevel>;
  system: SystemPolicy;
}

export interface PolicyLevel {
  handshake?: number;
  connIdle?: number;
  uplinkOnly?: number;
  downlinkOnly?: number;
  bufferSize?: number;
  statsUserUplink?: boolean;
  statsUserDownlink?: boolean;
}

export interface SystemPolicy {
  statsInboundUplink?: boolean;
  statsInboundDownlink?: boolean;
  statsOutboundUplink?: boolean;
  statsOutboundDownlink?: boolean;
}

export interface Inbound {
  port: number;
  listen?: string;
  protocol: string;
  settings: InboundSettings;
  streamSettings?: StreamSettings;
  sniffing?: SniffingConfig;
  tag: string;
}

export interface InboundSettings {
  clients?: Client[];
  decryption?: string;
}

export interface Client {
  id: string;
  email: string;
  flow?: string;
  limitIp?: number;
  totalGB?: number | string;
  expireTime?: number;
  createdAt?: string;
}

export interface StreamSettings {
  network: string;
  security: string;
  realitySettings?: RealitySettings;
  tcpSettings?: TcpSettings;
}

export interface RealitySettings {
  dest: string;
  serverNames: string[];
  privateKey: string;
  shortIds: string[];
  fingerprint: string;
  spiderX?: string;
}

export interface TcpSettings {
  header: {
    type: string;
  };
  acceptProxyProtocol?: boolean;
}

export interface SniffingConfig {
  enabled: boolean;
  destOverride: string[];
}

export interface Outbound {
  protocol: string;
  settings: Record<string, any>;
  tag: string;
}

export interface RoutingConfig {
  domainStrategy: string;
  rules: RoutingRule[];
}

export interface RoutingRule {
  type: string;
  inboundTag?: string[];
  outboundTag?: string;
}

// API Response Types
export interface XrayStatusResponse {
  success: boolean;
  data: string | XrayStatusData;
}

export interface XrayStatusData {
  isOk: boolean;
  data: {
    users: UserBandwidth[];
  };
}


export interface UserBandwidth {
  username: string;
  uplink: number; // in bytes
  downlink: number; // in bytes
}

export interface ServiceCreateParams {
  userId: number;
  userEmail: string;
  serviceId: number;
  serviceName: string;
  durationDays: number;
  dataLimitGB?: number | string;
  port?: number;
}

export interface ServiceMonitorResult {
  userId: number;
  userEmail: string;
  serviceId: number;
  usedGB: number;
  totalGB?: number;
  isDataLimitReached: boolean;
  isExpired: boolean;
  daysRemaining: number;
}




// ... existing types ...

export interface Server {
    id: number;
    name: string;
    domain: string;
    ip: string;
    api_port: number;
    xray_port: number;
    api_token: string;
    max_users: number;
    current_users: number;
    status: 'active' | 'maintenance' | 'offline';
    location: string;
    created_at: Date;
    updated_at: Date;
    last_checked_at?: Date;
    is_active: boolean;
}

export interface VlessLinkParams {
    uuid: string;
    serverHost: string;
    serverPort: number;
    email: string;
    security: string;
    sni: string;
    publicKey: string | undefined;
    shortId: string;
    networkType: string;
    flow?: string;
    encryption?: string;
}

export interface VlessLinkSet {
    standard: string;
    android: string;
    ios: string;
    linux: string;
    windows: string;
    macos: string;
    qrCodeAndroid?: string;
    qrCodeIos?: string;
    qrCodeWindows?: string;
}


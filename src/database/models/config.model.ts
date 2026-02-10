export interface UserConfig {
  id: number;
  user_id: number;
  service_id: number;
  vless_link: string;
  status: 'active' | 'expired' | 'test' | 'cancelled';
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  data_used_gb: number;
}
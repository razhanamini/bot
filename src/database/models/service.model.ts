export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  data_limit_gb: number | null;
  is_active: boolean;
  created_at: Date;
}
export interface ReferralSettings {
  id: number;
  is_enabled: boolean;
  commission_percent: number;
  min_withdrawal_amount: number;
  max_referrals_per_user: number;
  updated_at: Date;
}

export interface ReferralProfile {
  id: number;
  user_id: number;
  card_number: string;
  card_owner_name: string;
  total_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Referral {
  id: number;
  referrer_id: number;
  referred_id: number;
  referrer_telegram_id: number;
  created_at: Date;
}

export interface ReferralStats {
  total_referrals: number;
  total_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  card_number: string;
  card_owner_name: string;
}

export interface WithdrawalRequest {
  id: number;
  user_id: number;
  amount: number;
  card_number: string;
  card_owner_name: string;
  status: 'pending' | 'confirmed' | 'declined';
  admin_message_id: number | null;
  admin_chat_id: number | null;
  receipt_photo: string | null;
  telegram_id: number;
  created_at: Date;
  updated_at: Date;
  confirmed_at: Date | null;
}
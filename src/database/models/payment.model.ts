export interface Payment {
  id: number;
  user_id: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  receipt_photo: string | null;
  invoice_number: string;
  card_number: string;
  created_at: Date;
  updated_at: Date;
  admin_message_id: number | null;
  admin_chat_id: number | null;
}
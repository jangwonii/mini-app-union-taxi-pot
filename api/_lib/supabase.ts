import { createClient } from '@supabase/supabase-js';

export interface TaxiPotRow {
  id: string;
  start_location: string;
  destination: string;
  departure_time: string;
  estimated_fare: number;
  max_riders: number;
  description: string;
  tags: string[];
  open_chat_url: string;
  owner_user_id: string;
  owner_nickname: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface JoinRequestRow {
  id: string;
  pot_id: string;
  requester_user_id: string;
  requester_nickname: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  created_at: string;
  updated_at: string;
}

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

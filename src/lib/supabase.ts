import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const isMockMode = supabaseUrl.includes('placeholder');
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
}

export interface Court {
  id: string;
  name: string;
  status: 'available' | 'in_use' | 'maintenance';
  price_morning?: number;
  price_afternoon?: number;
  price_evening?: number;
}

export interface Booking {
  id: string;
  user_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  qr: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

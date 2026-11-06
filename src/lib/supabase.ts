import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isPlaceholder = (value: string): boolean => /YOUR_|MY_APP_URL|your-project/i.test(value);

/**
 * True when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present
 * and are not the placeholder values from .env.example.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !isPlaceholder(supabaseUrl) &&
    !isPlaceholder(supabaseAnonKey),
);

/**
 * Shared Supabase client. Null while the project credentials are missing,
 * which lets the app keep running on the bundled demo data.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

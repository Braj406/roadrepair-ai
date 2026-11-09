import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Newer Supabase projects call this the "publishable key"; older ones call it the "anon key". Either works.
const browserKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// When keys are missing the app runs in demo mode (accounts stored in this browser only).
export const supabase: SupabaseClient | null =
  url && browserKey ? createClient(url, browserKey) : null;

export const isDemoMode = !supabase;

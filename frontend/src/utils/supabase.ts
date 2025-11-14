import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;
export function getSupabase() {
  if (client) return client;
  if (!url || !key) {
    console.warn("[supabase] Not initialized: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
    return null;
  }
  client = createClient(url, key);
  return client;
}
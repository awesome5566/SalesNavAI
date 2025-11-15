import { createClient } from "@supabase/supabase-js";

console.log("[Supabase] Loading environment variables…", {
  mode: import.meta.env.MODE,
  envKeys: Object.keys(import.meta.env),
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("[Supabase] Config check", {
  hasUrl: Boolean(supabaseUrl),
  hasKey: Boolean(supabaseKey),
});

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "[Supabase] Missing configuration. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
  throw new Error("Supabase URL or API key is not set");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("[Supabase] Client created successfully");
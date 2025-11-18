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

// Network diagnostics helper
export const diagnoseNetwork = async () => {
  if (!supabaseUrl) {
    console.warn('[Supabase] Cannot diagnose: URL not configured');
    return null;
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    navigator: {
      onLine: navigator.onLine,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    },
    supabaseUrl: supabaseUrl,
    supabaseDomain: new URL(supabaseUrl).hostname,
    connectivity: null as any,
  };

  try {
    const testUrl = `${supabaseUrl}/rest/v1/`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(testUrl, {
      method: 'HEAD',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        apikey: supabaseKey || '',
      },
    });

    clearTimeout(timeout);
    diagnostics.connectivity = {
      success: true,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (err: any) {
    diagnostics.connectivity = {
      success: false,
      error: err.message,
      errorName: err.name,
    };
  }

  console.log('[Supabase] Network diagnostics:', diagnostics);
  return diagnostics;
};

// Run diagnostics in development mode
if (import.meta.env.DEV) {
  diagnoseNetwork();
}
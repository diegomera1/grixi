import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Create a Supabase browser client (singleton).
 * Uses environment variables passed from the server via root loader.
 */
export function getSupabaseBrowserClient(supabaseUrl: string, supabaseAnonKey: string) {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

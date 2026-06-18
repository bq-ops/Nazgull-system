import { createBrowserClient } from "@supabase/ssr";

/**
 * Use inside Client Components ('use client').
 * Safe to call on every render — createBrowserClient is memoised internally.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

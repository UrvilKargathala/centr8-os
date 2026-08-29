import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component with no request context — safe to
            // ignore, since proxy.ts refreshes the session cookie on every
            // request regardless.
          }
        },
      },
    },
  );
}

// Deduplicate supabase.auth.getUser() within a single request/render pass.
// Without this, proxy.ts + layout.tsx + page.tsx each call getUser()
// independently — 3 sequential Supabase HTTP round-trips. With cache(),
// only the first call hits Supabase; the rest return the cached result.
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});

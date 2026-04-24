import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetch as undiciFetch, ProxyAgent } from "undici";

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

// Custom fetch that routes through the HTTP proxy (required in mainland China)
const customFetch: typeof fetch = (input, init) => {
  if (proxyAgent) {
    return undiciFetch(input as string, { ...init, dispatcher: proxyAgent } as any) as unknown as Promise<Response>;
  }
  return undiciFetch(input as string, init as any) as unknown as Promise<Response>;
};

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: customFetch },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

export function createAdminClient() {
  // Service role client for Server Actions to bypass RLS
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { fetch: customFetch },
      cookies: {
        get() {
          return undefined;
        },
        set() {
          // no-op
        },
        remove() {
          // no-op
        },
      },
    }
  );
}

import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";

const mockCreateBrowserClient = vi.fn(() => ({ mockClient: true }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: any[]) => mockCreateBrowserClient(...args)
}));

describe("supabase/client", () => {
  it("creates browser client with env vars", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const client = createClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
    expect(client).toEqual({ mockClient: true });

    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });
});

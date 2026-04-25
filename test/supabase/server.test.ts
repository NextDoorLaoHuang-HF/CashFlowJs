import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockCreateServerClient = vi.fn(() => ({ mockServerClient: true }));
const mockCookieStore = {
  get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
  set: vi.fn()
};
const mockCookies = vi.fn(() => mockCookieStore);

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: any[]) => mockCreateServerClient(...args)
}));

vi.mock("next/headers", () => ({
  cookies: () => mockCookies()
}));

const mockUndiciFetch = vi.fn(() => Promise.resolve(new Response()));

vi.mock("undici", () => ({
  fetch: (...args: any[]) => mockUndiciFetch(...args),
  ProxyAgent: vi.fn((url: string) => ({ proxyUrl: url }))
}));

describe("supabase/server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
  });

  afterEach(() => {
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
  });

  it("creates server client with cookies adapter", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    // Dynamic import to ensure mocks are applied before module loads
    const { createClient } = await import("@/lib/supabase/server");
    const client = createClient();

    expect(mockCreateServerClient).toHaveBeenCalled();
    const config = mockCreateServerClient.mock.calls[0][2];

    // Verify custom fetch without proxy (else branch)
    await config.global.fetch("https://test.com", { method: "GET" });
    expect(mockUndiciFetch).toHaveBeenCalledWith("https://test.com", { method: "GET" });

    // Verify cookies.get
    expect(config.cookies.get("sb-session")).toBe("cookie-sb-session");
    expect(mockCookieStore.get).toHaveBeenCalledWith("sb-session");

    // Verify cookies.set (should swallow errors)
    config.cookies.set("sb-session", "new-value", { path: "/" });
    expect(mockCookieStore.set).toHaveBeenCalledWith({
      name: "sb-session",
      value: "new-value",
      path: "/"
    });

    // Verify cookies.remove (sets empty value)
    config.cookies.remove("sb-session", { path: "/" });
    expect(mockCookieStore.set).toHaveBeenLastCalledWith({
      name: "sb-session",
      value: "",
      path: "/"
    });

    expect(client).toEqual({ mockServerClient: true });
  });

  it("swallows cookie set/remove errors from Server Components", async () => {
    const throwingStore = {
      get: vi.fn(() => ({ value: "x" })),
      set: vi.fn(() => { throw new Error("read-only cookie store"); })
    };
    mockCookies.mockReturnValueOnce(throwingStore);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    vi.resetModules();
    const { createClient } = await import("@/lib/supabase/server");
    createClient();

    const config = mockCreateServerClient.mock.calls[0][2];

    // set error should be swallowed
    expect(() => config.cookies.set("x", "y", {})).not.toThrow();
    // remove error should be swallowed
    expect(() => config.cookies.remove("x", {})).not.toThrow();
  });

  it("creates admin client with service role and no-op cookies", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    const { createAdminClient } = await import("@/lib/supabase/server");
    const client = createAdminClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-service-role",
      expect.any(Object)
    );

    const config = mockCreateServerClient.mock.calls[0][2];
    expect(config.cookies.get()).toBeUndefined();
    expect(config.cookies.set("x", "y", {})).toBeUndefined();
    expect(config.cookies.remove("x", {})).toBeUndefined();
    expect(client).toEqual({ mockServerClient: true });
  });

  it("uses custom fetch with proxy when HTTPS_PROXY is set", async () => {
    process.env.HTTPS_PROXY = "http://proxy.example.com:8080";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

    vi.resetModules();
    const { createClient } = await import("@/lib/supabase/server");
    createClient();

    const config = mockCreateServerClient.mock.calls[0][2];
    expect(config.global.fetch).toBeDefined();
    expect(typeof config.global.fetch).toBe("function");

    // Call fetch to cover the proxy branch (lines 10-14)
    await config.global.fetch("https://test.com", { method: "POST" });
    expect(mockUndiciFetch).toHaveBeenCalled();
    const lastCall = mockUndiciFetch.mock.calls[mockUndiciFetch.mock.calls.length - 1];
    expect(lastCall[0]).toBe("https://test.com");
    expect(lastCall[1].dispatcher).toBeDefined();
  });
});

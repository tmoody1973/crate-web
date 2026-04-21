/**
 * Smoke tests for the /api/recommend/generate route handler.
 *
 * We can't cheaply run the full Convex action from here, so the tests focus
 * on the auth + body validation paths that live in the route handler itself.
 * The Convex action is mocked via vi.mock on the _generated api import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type AuthReturn = {
  userId: string | null;
  getToken: (args?: { template?: string }) => Promise<string | null>;
};

// ── Clerk auth mock ─────────────────────────────────────────────────────────
const authMock = vi.fn<() => Promise<AuthReturn>>();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

// ── Convex client mock ──────────────────────────────────────────────────────
const convexActionMock =
  vi.fn<(...args: unknown[]) => Promise<{ tourId: string; slug: string }>>();
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth() {}
    action(...args: unknown[]) {
      return convexActionMock(...args);
    }
  },
}));

// ── Auth0 Token Vault mock (avoid real HTTP) ────────────────────────────────
vi.mock("@/lib/auth0-token-vault", () => ({
  getTokenVaultToken: vi.fn(async () => null),
  isTokenVaultConfigured: vi.fn(() => false),
}));

// ── PostHog capture mock — never touch the network ─────────────────────────
vi.mock("@/lib/recommend-analytics", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recommend-analytics")
  >("@/lib/recommend-analytics");
  return {
    ...actual,
    trackRecommendServer: vi.fn(async () => {}),
  };
});

beforeEach(() => {
  authMock.mockReset();
  convexActionMock.mockReset();
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function importRoute() {
  // Import after mocks are in place; vitest re-runs the module per test.
  const mod = await import("../generate/route");
  return mod.POST;
}

function makeRequest(body: unknown): Request {
  return new Request("https://example.com/api/recommend/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/recommend/generate", () => {
  it("401 when unauthenticated", async () => {
    authMock.mockResolvedValue({
      userId: null,
      getToken: async () => null,
    });
    const POST = await importRoute();
    const res = await POST(makeRequest({ prompt: "hello" }));
    expect(res.status).toBe(401);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("400 for missing prompt", async () => {
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: async () => "token",
    });
    const POST = await importRoute();
    const res = await POST(makeRequest({ prompt: "" }));
    expect(res.status).toBe(400);
  });

  it("400 for invalid JSON body", async () => {
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: async () => "token",
    });
    const POST = await importRoute();
    const bad = new Request("https://example.com/api/recommend/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("200 forwards tourId + slug on success", async () => {
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: async () => "token",
    });
    convexActionMock.mockResolvedValue({
      tourId: "tour_abc",
      slug: "climate-dance-ab12",
    });
    const POST = await importRoute();
    const res = await POST(makeRequest({ prompt: "I want to dance" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      tourId: string;
      slug: string;
    };
    expect(data).toEqual({
      ok: true,
      tourId: "tour_abc",
      slug: "climate-dance-ab12",
    });
  });

  it("429 maps 'Daily tour limit reached' errors", async () => {
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: async () => "token",
    });
    convexActionMock.mockRejectedValue(
      new Error("Daily tour limit reached. Try again in 15 minutes."),
    );
    const POST = await importRoute();
    const res = await POST(makeRequest({ prompt: "anything" }));
    expect(res.status).toBe(429);
  });

  it("401 maps 'Not authenticated' errors from Convex", async () => {
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: async () => "token",
    });
    convexActionMock.mockRejectedValue(new Error("Not authenticated"));
    const POST = await importRoute();
    const res = await POST(makeRequest({ prompt: "anything" }));
    expect(res.status).toBe(401);
  });

  it("500 for unmapped errors", async () => {
    authMock.mockResolvedValue({
      userId: "user_123",
      getToken: async () => "token",
    });
    convexActionMock.mockRejectedValue(new Error("boom"));
    const POST = await importRoute();
    const res = await POST(makeRequest({ prompt: "anything" }));
    expect(res.status).toBe(500);
  });
});

export type PlanId = "free" | "pro" | "team";

export interface PlanLimits {
  agentQueriesPerMonth: number;
  savedSessions: number | null; // null = unlimited
  hasPublishing: boolean;
  hasMemory: boolean;
  hasInfluenceCache: boolean;
  hasAdminDashboard: boolean;
  hasSharedOrgKeys: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    agentQueriesPerMonth: 10,
    savedSessions: 5,
    hasPublishing: false,
    hasMemory: false,
    hasInfluenceCache: false,
    hasAdminDashboard: false,
    hasSharedOrgKeys: false,
  },
  pro: {
    agentQueriesPerMonth: 50,
    savedSessions: null,
    hasPublishing: true,
    hasMemory: true,
    hasInfluenceCache: true,
    hasAdminDashboard: false,
    hasSharedOrgKeys: false,
  },
  team: {
    agentQueriesPerMonth: 200, // pooled by domain
    savedSessions: null,
    hasPublishing: true,
    hasMemory: true,
    hasInfluenceCache: true,
    hasAdminDashboard: true,
    hasSharedOrgKeys: true,
  },
};

/** Super admin emails — bypass all limits and feature gates. */
const ADMIN_EMAILS = ["tarikjmoody@gmail.com"];

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Tool call cap per agent query. */
export const TOOL_CALL_CAP = 25;

/** Grace period (ms) after currentPeriodEnd for past_due users. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Blocked email domains for team plan creation. */
export const BLOCKED_TEAM_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "aol.com", "icloud.com", "protonmail.com", "mail.com",
];

/** In-memory rate limiter. */
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(
  key: string,
  maxPerMinute: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > 60_000) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxPerMinute - 1 };
  }

  if (entry.count >= maxPerMinute) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxPerMinute - entry.count };
}

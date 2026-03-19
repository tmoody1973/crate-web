import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { PLAN_LIMITS, isAdmin } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Admin gets unlimited
  if (isAdmin(user.email ?? "")) {
    return Response.json({
      plan: "admin",
      agentQueriesUsed: 0,
      agentQueriesLimit: -1,
      periodEnd: "",
      hasBYOK: true,
    });
  }

  const sub = await convex.query(api.subscriptions.getByUserId, { userId: user._id });
  const plan: PlanId = sub?.status === "active" ? sub.plan : "free";
  const limits = PLAN_LIMITS[plan];

  // Get usage
  const now = new Date();
  const periodStart = sub?.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const usage = await convex.query(api.usage.getUsageSummary, { userId: user._id, periodStart });

  // Check if user has BYOK
  let hasBYOK = false;
  if (user.encryptedKeys) {
    try {
      const { decrypt } = await import("@/lib/encryption");
      const rawKeys = JSON.parse(decrypt(Buffer.from(new Uint8Array(user.encryptedKeys as unknown as ArrayLike<number>))));
      hasBYOK = !!(rawKeys.anthropic || rawKeys.openrouter);
    } catch {
      hasBYOK = false;
    }
  }

  return Response.json({
    plan,
    agentQueriesUsed: usage.agentQueriesUsed,
    agentQueriesLimit: limits.agentQueriesPerMonth,
    periodEnd: sub?.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "",
    hasBYOK,
  });
}

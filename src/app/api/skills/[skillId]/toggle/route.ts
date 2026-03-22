import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function verifyOwnership(clerkId: string, skillId: string) {
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return new Response("User not found", { status: 404 });
  const skills = await convex.query(api.userSkills.listByUser, { userId: user._id });
  const owns = skills.some((s) => s._id === skillId);
  if (!owns) return new Response("Not your skill", { status: 403 });
  return null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const { skillId } = await params;
  const denied = await verifyOwnership(clerkId, skillId);
  if (denied) return denied;
  await convex.mutation(api.userSkills.toggleEnabled, {
    skillId: skillId as Id<"userSkills">,
  });
  return Response.json({ success: true });
}

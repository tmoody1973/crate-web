import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });
  const { skillId } = await params;
  await convex.mutation(api.userSkills.toggleEnabled, {
    skillId: skillId as Id<"userSkills">,
  });
  return Response.json({ success: true });
}

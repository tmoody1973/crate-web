import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { detectDeepCutType } from "@/lib/deep-cut-utils";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { artifactId: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.artifactId || body.artifactId === "pending") {
    return Response.json({ error: "Artifact not saved yet" }, { status: 400 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Check if already published — return existing URL
  const existing = await convex.query(api.shares.getByArtifact, {
    artifactId: body.artifactId as Id<"artifacts">,
  });
  if (existing?.isPublic) {
    const url = `https://digcrate.app/cuts/${existing.shareId}`;
    return Response.json({ shareId: existing.shareId, url, existing: true });
  }

  // Look up the artifact
  const artifact = await convex.query(api.artifacts.getById, {
    id: body.artifactId as Id<"artifacts">,
  });
  if (!artifact) return Response.json({ error: "Artifact not found" }, { status: 404 });

  // Verify ownership
  if (artifact.userId !== user._id) {
    return Response.json({ error: "Not your artifact" }, { status: 403 });
  }

  const shareId = nanoid(10);
  const type = detectDeepCutType(artifact.data);

  await convex.mutation(api.shares.create, {
    shareId,
    artifactId: body.artifactId as Id<"artifacts">,
    userId: user._id,
    label: artifact.label,
    type,
    data: artifact.data,
  });

  const url = `https://digcrate.app/cuts/${shareId}`;
  return Response.json({ shareId, url });
}

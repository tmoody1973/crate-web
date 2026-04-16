import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface SkillRow {
  _id: string;
  command: string;
  name: string;
  description: string;
  isEnabled: boolean;
}

interface SkillResponse {
  command: string;
  description: string;
  name: string;
  isCustom: boolean;
}

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return Response.json({ skills: [] });
  }

  const skills = await convex.query(api.userSkills.listByUser, {
    userId: user._id,
  });

  // Full mode returns all skills with full details (for Settings)
  const url = new URL(req.url);
  if (url.searchParams.get("full") === "true") {
    return Response.json({ skills });
  }

  // Return only enabled skills, mapped to the shape ChatInput needs
  const enabled: SkillResponse[] = (skills as SkillRow[])
    .filter((s) => s.isEnabled)
    .map((s) => ({
      command: `/${s.command}`,
      description: s.description,
      name: s.name,
      isCustom: true,
    }));

  return Response.json({ skills: enabled });
}

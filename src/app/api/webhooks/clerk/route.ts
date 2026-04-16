import { Webhook } from "svix";
import { headers } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getPostHogClient } from "@/lib/posthog-server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses?.[0]?.email_address ?? "";
    const name =
      [first_name, last_name].filter(Boolean).join(" ") || undefined;

    await convex.mutation(api.users.upsert, {
      clerkId: id,
      email,
      name,
    });

    if (evt.type === "user.created") {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: id,
        event: "user_signed_up",
        properties: { email, name },
      });
      posthog.identify({
        distinctId: id,
        properties: { email, name },
      });
    }
  }

  return new Response("OK", { status: 200 });
}

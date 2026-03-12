import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { encrypt, decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET — list org key configs the current user administers
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check if user has org keys shared with their domain
  const emailDomain = user.email?.split("@")[1] ?? "";
  const orgRecord = emailDomain
    ? await convex.query(api.orgKeys.getByDomain, { domain: emailDomain })
    : null;

  // Check if user is admin of any org keys (by checking their own user keys shared to a domain)
  // For now, return their own personal keys + what domain they're sharing to
  let adminDomains: Array<{ domain: string; keys: Record<string, string> }> = [];

  // Users can also check if they have org-shared keys available
  let sharedKeysAvailable = false;
  if (orgRecord) {
    sharedKeysAvailable = true;
    if (orgRecord.adminUserId === user._id) {
      const decrypted = JSON.parse(decrypt(Buffer.from(orgRecord.encryptedKeys)));
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(decrypted)) {
        const v = value as string;
        masked[key] = v.length > 6 ? "••••••" + v.slice(-4) : "••••••";
      }
      adminDomains = [{ domain: emailDomain, keys: masked }];
    }
  }

  return NextResponse.json({
    isAdmin: adminDomains.length > 0 || orgRecord?.adminUserId === user._id,
    adminDomains,
    sharedKeysAvailable,
    email: user.email,
  });
}

// POST — share your keys with a domain
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { domain } = await req.json();
  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  // Get the admin user's personal keys to share
  if (!user.encryptedKeys) {
    return NextResponse.json(
      { error: "You have no API keys configured. Add keys in Settings first." },
      { status: 400 },
    );
  }

  // Re-encrypt the admin's keys and store as org keys for the domain
  const rawKeys = decrypt(Buffer.from(user.encryptedKeys));
  const encrypted = encrypt(rawKeys);
  const ab = new ArrayBuffer(encrypted.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < encrypted.length; i++) {
    view[i] = encrypted[i];
  }

  await convex.mutation(api.orgKeys.store, {
    domain,
    encryptedKeys: ab,
    adminUserId: user._id,
  });

  return NextResponse.json({ success: true, domain });
}

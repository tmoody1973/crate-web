import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { encrypt, decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Get or auto-create the Convex user for the current Clerk session. */
async function getOrCreateUser(clerkId: string) {
  const existing = await convex.query(api.users.getByClerkId, { clerkId });
  if (existing) return existing;

  // Auto-create user if webhook hasn't fired yet (common in local dev)
  const clerk = await currentUser();
  const email = clerk?.emailAddresses?.[0]?.emailAddress ?? "";
  const name =
    [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ") || undefined;

  const userId = await convex.mutation(api.users.upsert, {
    clerkId,
    email,
    name,
  });

  return await convex.query(api.users.getByClerkId, { clerkId });
}

// GET — return masked keys
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOrCreateUser(clerkId);

    // Start with user's personal keys
    const masked: Record<string, string> = {};
    if (user?.encryptedKeys) {
      const decrypted = JSON.parse(
        decrypt(Buffer.from(new Uint8Array(user.encryptedKeys))),
      );
      for (const [key, value] of Object.entries(decrypted)) {
        const v = value as string;
        masked[key] = v.length > 6 ? "••••••" + v.slice(-4) : "••••••";
      }
    }

    // Check for org shared keys (show as "Shared" for services user hasn't configured)
    const emailDomain = user?.email?.split("@")[1] ?? "";
    if (emailDomain) {
      const orgRecord = await convex.query(api.orgKeys.getByDomain, { domain: emailDomain });
      if (orgRecord?.encryptedKeys) {
        const orgDecrypted = JSON.parse(
          decrypt(Buffer.from(orgRecord.encryptedKeys)),
        );
        for (const key of Object.keys(orgDecrypted)) {
          if (!masked[key]) {
            masked[key] = "Shared by team";
          }
        }
      }
    }

    return NextResponse.json({ keys: masked });
  } catch (err) {
    console.error("[GET /api/keys] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

// POST — save a key
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { service, value } = await req.json();
    if (!service || !value) {
      return NextResponse.json(
        { error: "Missing service or value" },
        { status: 400 },
      );
    }

    const user = await getOrCreateUser(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get existing keys
    let existing: Record<string, string> = {};
    if (user.encryptedKeys) {
      existing = JSON.parse(decrypt(Buffer.from(user.encryptedKeys)));
    }

    // Add/update the key
    existing[service] = value;

    // Re-encrypt and store — convert Buffer to ArrayBuffer for Convex v.bytes()
    const encrypted = encrypt(JSON.stringify(existing));
    const ab = new ArrayBuffer(encrypted.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < encrypted.length; i++) {
      view[i] = encrypted[i];
    }

    await convex.mutation(api.keys.store, {
      userId: user._id,
      encryptedKeys: ab,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/keys] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

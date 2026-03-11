import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { encrypt, decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET — return masked keys
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user?.encryptedKeys) {
    return NextResponse.json({ keys: {} });
  }

  const decrypted = JSON.parse(decrypt(Buffer.from(user.encryptedKeys)));
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(decrypted)) {
    const v = value as string;
    masked[key] = v.length > 6 ? "••••••" + v.slice(-4) : "••••••";
  }

  return NextResponse.json({ keys: masked });
}

// POST — save a key
export async function POST(req: Request) {
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

  const user = await convex.query(api.users.getByClerkId, { clerkId });
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

  // Re-encrypt and store
  const encrypted = encrypt(JSON.stringify(existing));
  await convex.mutation(api.keys.store, {
    userId: user._id,
    encryptedKeys: encrypted.buffer.slice(
      encrypted.byteOffset,
      encrypted.byteOffset + encrypted.byteLength,
    ) as ArrayBuffer,
  });

  return NextResponse.json({ success: true });
}

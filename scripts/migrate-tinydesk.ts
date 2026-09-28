/**
 * One-time migration: move static Tiny Desk companion JSON into Convex.
 *
 * Usage:
 *   npx tsx scripts/migrate-tinydesk.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://charming-pony-311.convex.cloud";
const CLERK_ID = "user_3C2Ghqwltlwrn7IxM7xqJeYwu75"; // Tarik's production Clerk ID

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  // Get Tarik's Convex user ID
  const user = await client.query(api.users.getByClerkId, { clerkId: CLERK_ID });
  if (!user) throw new Error("User not found for Clerk ID: " + CLERK_ID);

  const dir = join(process.cwd(), "public", "tinydesk");
  const files = await readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  console.log(`Found ${jsonFiles.length} JSON files to migrate`);

  for (const file of jsonFiles) {
    const raw = await readFile(join(dir, file), "utf-8");
    const data = JSON.parse(raw);

    await client.mutation(api.tinydeskCompanions.create, {
      slug: data.slug,
      artist: data.artist,
      tagline: data.tagline,
      tinyDeskVideoId: data.tinyDeskVideoId,
      nodes: JSON.stringify(data.nodes),
      userId: user._id,
    });

    console.log(`Migrated: ${data.artist} (${data.slug})`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

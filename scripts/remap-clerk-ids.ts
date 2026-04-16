/**
 * Remap Clerk user IDs in Convex after dev-to-prod migration.
 *
 * Usage:
 *   1. Create clerk-id-map.json with mappings: [{ oldClerkId, newClerkId, email }]
 *   2. Run dry run:  CONVEX_URL=... CONVEX_ADMIN_KEY=... npx tsx scripts/remap-clerk-ids.ts --dry-run
 *   3. Run live:     CONVEX_URL=... CONVEX_ADMIN_KEY=... npx tsx scripts/remap-clerk-ids.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import fs from "node:fs/promises";

const CONVEX_URL = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const BATCH_SIZE = 50;
const dryRun = process.argv.includes("--dry-run");

if (!CONVEX_URL) {
  console.error("Missing CONVEX_URL environment variable");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  const mapFile = process.argv.find((a) => a.endsWith(".json")) ?? "./clerk-id-map.json";

  let mappings: Array<{ oldClerkId: string; newClerkId: string; email?: string }>;
  try {
    const raw = await fs.readFile(mapFile, "utf8");
    mappings = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${mapFile}:`, err);
    console.error("\nExpected format: [{ \"oldClerkId\": \"user_xxx\", \"newClerkId\": \"user_yyy\", \"email\": \"...\" }]");
    process.exit(1);
  }

  console.log(`\nClerk ID Remap — ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Mappings: ${mappings.length} users`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Convex URL: ${CONVEX_URL}\n`);

  let totalUpdated = 0;
  let totalMissing = 0;
  let totalConflicts = 0;
  let totalNoop = 0;

  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Batch ${batchNum} (${batch.length} users)...`);

    const result = await client.mutation(api.users.remapClerkIds, {
      adminSecret: process.env.ADMIN_SECRET ?? process.env.ENCRYPTION_KEY ?? "",
      mappings: batch,
      dryRun,
    });

    totalUpdated += result.updated;
    totalMissing += result.missing;
    totalConflicts += result.conflicts;
    totalNoop += result.noop;

    // Log any issues
    for (const r of result.results) {
      if (r.status === "missing") {
        console.log(`  MISSING: ${r.oldClerkId} (${r.email ?? "no email"})`);
      } else if (r.status === "conflict") {
        console.log(`  CONFLICT: ${r.oldClerkId} -> ${r.newClerkId} (new ID already exists on different user)`);
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total:     ${mappings.length}`);
  console.log(`Updated:   ${totalUpdated}`);
  console.log(`Missing:   ${totalMissing}`);
  console.log(`Conflicts: ${totalConflicts}`);
  console.log(`No-op:     ${totalNoop}`);

  if (dryRun) {
    console.log(`\nThis was a DRY RUN. No changes were made.`);
    console.log(`Run without --dry-run to apply changes.`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Helpers ──────────────────────────────────────────────
// Canonical slugify lives at src/lib/slug.ts. Convex functions can't import
// from src/, so we keep a local copy. Both MUST use the same algorithm.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Shared validator fragments ───────────────────────────

const sectionSourceValidator = v.object({
  tool: v.string(),
  url: v.optional(v.string()),
  fetchedAt: v.number(),
});

const sectionValidator = v.object({
  heading: v.string(),
  content: v.string(),
  sources: v.array(sectionSourceValidator),
  lastSynthesizedAt: v.optional(v.number()),
});

const contradictionValidator = v.object({
  claim1: v.object({ source: v.string(), value: v.string() }),
  claim2: v.object({ source: v.string(), value: v.string() }),
  field: v.string(),
});

const metadataValidator = v.object({
  origin: v.optional(v.string()),
  yearsActive: v.optional(v.string()),
  members: v.optional(v.array(v.string())),
  genreDNA: v.optional(v.array(v.string())),
});

// ── Queries ──────────────────────────────────────────────

/** Get a wiki page by user slug + entity slug, with access control.
 *  Called from Next.js server components via ConvexHttpClient (no Clerk JWT).
 *  viewerClerkId is passed from the server component after calling Clerk auth(). */
export const getBySlug = query({
  args: {
    userSlug: v.string(),
    slug: v.string(),
    viewerClerkId: v.optional(v.string()),
  },
  handler: async (ctx, { userSlug, slug, viewerClerkId }) => {
    // Find page owner by name slug
    // TODO Phase 2: Add usernameSlug field with unique index to users table
    const allUsers = await ctx.db.query("users").collect();
    const owner = allUsers.find(
      (u) => slugify(u.name ?? u.email.split("@")[0]) === userSlug,
    );
    if (!owner) return null;

    const page = await ctx.db
      .query("wikiPages")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", owner._id).eq("slug", slug),
      )
      .first();

    if (!page) return null;
    if (page.archivedAt) return null;

    // Access control: private pages only visible to owner
    // viewerClerkId comes from Clerk auth() in the server component, not from the browser
    if (page.visibility === "private") {
      if (!viewerClerkId || owner.clerkId !== viewerClerkId) {
        return null;
      }
    }

    return { ...page, ownerName: owner.name ?? owner.email.split("@")[0] };
  },
});

/** List all non-archived wiki pages for a user via the index table. */
export const listUserPages = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("wikiIndexEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return entries.sort((a, b) => b.lastUpdated - a.lastUpdated);
  },
});

/** Get wiki entry count for a user (for sidebar badge). */
export const getEntryCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("wikiIndexEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return entries.length;
  },
});

// ── Mutations ────────────────────────────────────────────

/** Append raw section data from a tool result. Fast, append-only. */
export const appendWikiData = mutation({
  args: {
    userId: v.id("users"),
    entityName: v.string(),
    section: v.object({
      heading: v.string(),
      content: v.string(),
      sources: v.array(sectionSourceValidator),
    }),
  },
  handler: async (ctx, { userId, entityName, section }) => {
    const slug = slugify(entityName);
    const now = Date.now();

    const existing = await ctx.db
      .query("wikiPages")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", slug),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sections: [
          ...existing.sections,
          { ...section, lastSynthesizedAt: undefined },
        ],
        ...(existing.archivedAt ? { archivedAt: undefined } : {}),
        updatedAt: now,
      });

      const indexEntry = await ctx.db
        .query("wikiIndexEntries")
        .withIndex("by_user_slug", (q) =>
          q.eq("userId", userId).eq("slug", slug),
        )
        .first();
      if (indexEntry) {
        await ctx.db.patch(indexEntry._id, {
          sourceCount: existing.sections.length + 1,
          lastUpdated: now,
        });
      }

      await ctx.db.insert("wikiLogEntries", {
        userId,
        timestamp: now,
        operation: "ingest",
        entitySlug: slug,
        description: `Updated ${entityName} with ${section.heading}`,
        toolsUsed: section.sources.map((s) => s.tool),
      });

      return existing._id;
    }

    // Create new page
    const pageId = await ctx.db.insert("wikiPages", {
      userId,
      slug,
      entityType: "artist",
      entityName,
      sections: [{ ...section, lastSynthesizedAt: undefined }],
      contradictions: [],
      metadata: {},
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("wikiIndexEntries", {
      userId,
      pageId,
      slug,
      entityName,
      entityType: "artist",
      visibility: "private",
      sourceCount: 1,
      lastUpdated: now,
    });

    await ctx.db.insert("wikiLogEntries", {
      userId,
      timestamp: now,
      operation: "ingest",
      entitySlug: slug,
      description: `Created wiki page for ${entityName}`,
      toolsUsed: section.sources.map((s) => s.tool),
    });

    return pageId;
  },
});

/** Toggle visibility (private/unlisted/public). Owner only. */
export const toggleVisibility = mutation({
  args: {
    pageId: v.id("wikiPages"),
    userId: v.id("users"),
    visibility: v.union(
      v.literal("private"),
      v.literal("unlisted"),
      v.literal("public"),
    ),
  },
  handler: async (ctx, { pageId, userId, visibility }) => {
    const page = await ctx.db.get(pageId);
    if (!page || page.userId !== userId) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(pageId, { visibility, updatedAt: Date.now() });

    // Keep index entry visibility in sync
    const indexEntry = await ctx.db
      .query("wikiIndexEntries")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", page.slug),
      )
      .first();
    if (indexEntry) {
      await ctx.db.patch(indexEntry._id, { visibility });
    }
  },
});

/** Soft-delete a wiki page. Owner only. */
export const archivePage = mutation({
  args: {
    pageId: v.id("wikiPages"),
    userId: v.id("users"),
  },
  handler: async (ctx, { pageId, userId }) => {
    const page = await ctx.db.get(pageId);
    if (!page || page.userId !== userId) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(pageId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    const indexEntry = await ctx.db
      .query("wikiIndexEntries")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", page.slug),
      )
      .first();
    if (indexEntry) {
      await ctx.db.delete(indexEntry._id);
    }
  },
});

// ── Actions (external API calls) ─────────────────────────

const SYNTHESIS_PROMPT = `You are a music encyclopedia editor. Given an artist's wiki page data from multiple sources, produce a clean, synthesized version.

INPUT: You'll receive the artist name and raw section data from various music data sources (Spotify, WhoSampled, Bandcamp, etc.).

OUTPUT (JSON):
{
  "description": "A 2-3 sentence blurb about the artist, written in encyclopedia style. Cite what makes them distinctive.",
  "sections": [
    {
      "heading": "Section heading (e.g., 'Overview', 'Musical Style', 'Discography Highlights')",
      "content": "Merged, deduplicated content for this section. If multiple sources say the same thing, keep the most detailed version. Remove redundancy.",
      "sources": [{"tool": "source-name", "url": "optional-url", "fetchedAt": timestamp}]
    }
  ],
  "contradictions": [
    {
      "claim1": {"source": "tool-name", "value": "what source 1 says"},
      "claim2": {"source": "tool-name", "value": "what source 2 says"},
      "field": "the field that disagrees (e.g., 'genre', 'formed_year', 'origin')"
    }
  ],
  "metadata": {
    "origin": "city/country if mentioned",
    "yearsActive": "start-present or start-end",
    "members": ["member names if mentioned"],
    "genreDNA": ["genre tags from across sources, deduplicated"]
  }
}

RULES:
- Merge duplicate information. If Spotify and Bandcamp both say "funk", keep one entry.
- Flag contradictions explicitly. If Spotify says "psychedelic rock" but Bandcamp says "surf rock", that's a contradiction.
- Preserve source attribution. Every fact should trace back to which tool provided it.
- Write the description as if for a music encyclopedia, not a chatbot response.
- Keep sections focused. Combine related data, split unrelated topics.
- Extract metadata from ALL sections. Genre tags from every source, deduplicated.`;

/** Call Haiku API for synthesis. Returns parsed JSON or null on failure. */
async function callHaikuSynthesis(
  apiKey: string,
  userPrompt: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYNTHESIS_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    console.error("[wiki/synthesize] API error:", response.status);
    return null;
  }

  const result = await response.json();
  const text = result.content?.[0]?.text;
  if (!text) return null;

  const cleaned = text.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "");
  const parsed = JSON.parse(cleaned);

  // Validate expected shape
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.sections && !Array.isArray(parsed.sections)) return null;

  return parsed;
}

/** Synthesize a wiki page using Haiku. Retries once on failure. */
export const synthesizeWikiPage = action({
  args: { pageId: v.id("wikiPages") },
  handler: async (ctx, { pageId }) => {
    const page = await ctx.runQuery(internal.wiki.getPageInternal, { pageId });
    if (!page) return;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[wiki/synthesize] No ANTHROPIC_API_KEY set");
      return;
    }

    const userPrompt = `Artist: ${page.entityName}

Raw section data:
${JSON.stringify(page.sections, null, 2)}

Synthesize this into a clean wiki page. Output valid JSON only.`;

    // Try up to 2 attempts
    let synthesized: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        synthesized = await callHaikuSynthesis(apiKey, userPrompt);
        if (synthesized) break;
      } catch (err) {
        console.error(`[wiki/synthesize] Attempt ${attempt + 1} failed:`, err);
        if (attempt === 0) continue; // retry once
      }
    }

    if (!synthesized) {
      console.error("[wiki/synthesize] All attempts failed for", page.entityName);
      return; // Page stays unsynthesized — valid state
    }

    const now = Date.now();

    // Sanitize Haiku output to match Convex validators exactly.
    // Haiku may add extra fields that the strict validators reject.
    const rawSections = Array.isArray(synthesized.sections) ? synthesized.sections : [];
    const sections = rawSections.map((s: Record<string, unknown>) => ({
      heading: String(s.heading ?? ""),
      content: String(s.content ?? ""),
      sources: Array.isArray(s.sources)
        ? (s.sources as Array<Record<string, unknown>>).map((src) => ({
            tool: String(src.tool ?? src.name ?? "Unknown"),
            url: typeof src.url === "string" ? src.url : undefined,
            fetchedAt: typeof src.fetchedAt === "number" ? src.fetchedAt : now,
          }))
        : [],
      lastSynthesizedAt: now,
    }));

    const rawContradictions = Array.isArray(synthesized.contradictions) ? synthesized.contradictions : [];
    const contradictions = rawContradictions.map((c: Record<string, unknown>) => ({
      claim1: {
        source: String((c.claim1 as Record<string, unknown>)?.source ?? ""),
        value: String((c.claim1 as Record<string, unknown>)?.value ?? ""),
      },
      claim2: {
        source: String((c.claim2 as Record<string, unknown>)?.source ?? ""),
        value: String((c.claim2 as Record<string, unknown>)?.value ?? ""),
      },
      field: String(c.field ?? ""),
    }));

    const meta = (synthesized.metadata ?? {}) as Record<string, unknown>;
    const metadata = {
      origin: typeof meta.origin === "string" ? meta.origin : undefined,
      yearsActive: typeof meta.yearsActive === "string" ? meta.yearsActive : undefined,
      members: Array.isArray(meta.members) ? meta.members.map(String) : undefined,
      genreDNA: Array.isArray(meta.genreDNA) ? meta.genreDNA.map(String) : undefined,
    };

    await ctx.runMutation(internal.wiki.updateSynthesized, {
      pageId,
      description: String(synthesized.description ?? ""),
      sections,
      contradictions,
      metadata,
    });
  },
});

// ── Internal functions (action → query/mutation bridge) ──

export const getPageInternal = internalQuery({
  args: { pageId: v.id("wikiPages") },
  handler: async (ctx, { pageId }) => {
    return await ctx.db.get(pageId);
  },
});

export const updateSynthesized = internalMutation({
  args: {
    pageId: v.id("wikiPages"),
    description: v.string(),
    sections: v.array(sectionValidator),
    contradictions: v.array(contradictionValidator),
    metadata: metadataValidator,
  },
  handler: async (ctx, { pageId, description, sections, contradictions, metadata }) => {
    const now = Date.now();
    await ctx.db.patch(pageId, {
      description,
      sections,
      contradictions,
      metadata,
      updatedAt: now,
    });

    const page = await ctx.db.get(pageId);
    if (page) {
      const indexEntry = await ctx.db
        .query("wikiIndexEntries")
        .withIndex("by_user_slug", (q) =>
          q.eq("userId", page.userId).eq("slug", page.slug),
        )
        .first();
      if (indexEntry) {
        await ctx.db.patch(indexEntry._id, {
          summary: description.slice(0, 200),
          lastUpdated: now,
        });
      }

      await ctx.db.insert("wikiLogEntries", {
        userId: page.userId,
        timestamp: now,
        operation: "synthesize",
        entitySlug: page.slug,
        description: `Synthesized ${page.entityName} (${sections.length} sections, ${contradictions.length} contradictions)`,
      });
    }
  },
});

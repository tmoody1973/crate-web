/**
 * Web-specific Telegraph tool handlers.
 * Uses Convex (via ConvexHttpClient) instead of SQLite for persistence.
 * Ported from crate-cli/dist/servers/telegraph.js.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const TELEGRAPH_API = "https://api.telegra.ph";

// ── Telegraph API helper ──────────────────────────────────────────

async function telegraphCall(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${TELEGRAPH_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return (await res.json()) as {
    ok: boolean;
    result?: Record<string, unknown>;
    error?: string;
  };
}

// ── Markdown → Telegraph nodes ────────────────────────────────────

type TelegraphNode = string | {
  tag: string;
  attrs?: Record<string, string>;
  children?: TelegraphNode[];
};

function parseInline(text: string): TelegraphNode[] {
  const result: TelegraphNode[] = [];
  const inlineRe =
    /`([^`]+?)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s,)<>]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      result.push({ tag: "code", children: [match[1]] });
    } else if (match[2] !== undefined) {
      result.push({ tag: "b", children: [match[2]] });
    } else if (match[3] !== undefined) {
      result.push({ tag: "em", children: [match[3]] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      result.push({ tag: "a", attrs: { href: match[5] }, children: [match[4]] });
    } else if (match[6] !== undefined) {
      result.push({ tag: "a", attrs: { href: match[6] }, children: [match[6]] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result;
}

export function markdownToNodes(text: string): TelegraphNode[] {
  const nodes: TelegraphNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") { i++; continue; }

    if (/^---+$/.test(line.trim())) {
      nodes.push({ tag: "hr" });
      i++; continue;
    }

    const headingMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (headingMatch) {
      nodes.push({ tag: "h4", children: parseInline(headingMatch[1]!) });
      i++; continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]?.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      nodes.push({ tag: "blockquote", children: parseInline(quoteLines.join("\n")) });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const listItems: TelegraphNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        const itemText = (lines[i] ?? "").replace(/^[-*]\s+/, "");
        listItems.push({ tag: "li", children: parseInline(itemText) });
        i++;
      }
      nodes.push({ tag: "ul", children: listItems });
      continue;
    }

    if (line.trimEnd().startsWith("```")) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i]!.trimEnd().startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      nodes.push({ tag: "pre", children: [codeLines.join("\n")] });
      continue;
    }

    nodes.push({ tag: "p", children: parseInline(line) });
    i++;
  }

  return nodes;
}

// ── Index page builder ────────────────────────────────────────────

interface EntryForIndex {
  title: string;
  telegraphUrl: string;
  category?: string;
  createdAt: number;
}

function buildIndexContent(
  authorName: string,
  entries: EntryForIndex[],
): TelegraphNode[] {
  const nodes: TelegraphNode[] = [];

  nodes.push({ tag: "p", children: [{ tag: "b", children: [`${authorName}'s Crate Digs`] }] });
  nodes.push({ tag: "hr" });

  if (entries.length === 0) {
    nodes.push({ tag: "p", children: [{ tag: "em", children: ["No entries yet. Start sharing your discoveries!"] }] });
    return nodes;
  }

  for (const entry of entries) {
    const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const categoryTag = entry.category
      ? `[${entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}] `
      : "";
    const label = `${categoryTag}${entry.title} (${date})`;
    nodes.push({
      tag: "p",
      children: [{ tag: "a", attrs: { href: entry.telegraphUrl }, children: [label] }],
    });
  }

  return nodes;
}

async function rebuildIndex(
  convex: ConvexHttpClient,
  userId: Id<"users">,
): Promise<void> {
  const authRecord = await convex.query(api.telegraph.getAuth, { userId });
  if (!authRecord?.indexPagePath) return;

  const entries = await convex.query(api.telegraph.listEntries, { userId });
  const authorName = authRecord.authorName || "My";
  const content = buildIndexContent(authorName, entries);

  const resp = await telegraphCall("editPage", {
    access_token: authRecord.accessToken,
    path: authRecord.indexPagePath,
    title: `${authorName}'s Crate Digs`,
    content: JSON.stringify(content),
    return_content: false,
  });

  if (!resp.ok) {
    throw new Error(`Failed to update index page: ${resp.error ?? "unknown error"}`);
  }
}

// ── Tool result helpers ───────────────────────────────────────────

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  };
}

// ── Handlers ──────────────────────────────────────────────────────

export function createTelegraphTools(
  convexUrl: string,
  userId: Id<"users">,
): CrateToolDef[] {
  const convex = new ConvexHttpClient(convexUrl);

  const setupPageHandler = async (args: { author_name?: string }) => {
    try {
      const existing = await convex.query(api.telegraph.getAuth, { userId });
      if (existing?.indexPagePath) {
        return toolResult({
          status: "already_setup",
          url: `https://telegra.ph/${existing.indexPagePath}`,
          author_name: existing.authorName,
        });
      }

      const authorName = args.author_name || "Crate Digger";

      const accountResp = await telegraphCall("createAccount", {
        short_name: "crate",
        author_name: authorName,
      });
      if (!accountResp.ok || !accountResp.result?.access_token) {
        throw new Error(`Failed to create Telegraph account: ${accountResp.error ?? "unknown error"}`);
      }

      const accessToken = accountResp.result.access_token as string;

      const indexContent = buildIndexContent(authorName, []);
      const pageResp = await telegraphCall("createPage", {
        access_token: accessToken,
        title: `${authorName}'s Crate Digs`,
        content: JSON.stringify(indexContent),
        author_name: authorName,
        return_content: false,
      });
      if (!pageResp.ok || !pageResp.result?.path) {
        throw new Error(`Failed to create index page: ${pageResp.error ?? "unknown error"}`);
      }

      const indexPath = pageResp.result.path as string;
      const indexUrl = pageResp.result.url as string;

      await convex.mutation(api.telegraph.saveAuth, {
        userId,
        accessToken,
        authorName,
        indexPagePath: indexPath,
        indexPageUrl: indexUrl,
      });

      return toolResult({ status: "created", url: indexUrl, author_name: authorName });
    } catch (error) {
      return toolError(error);
    }
  };

  const postToPageHandler = async (args: {
    title: string;
    content: string;
    category?: string;
  }) => {
    try {
      const authRecord = await convex.query(api.telegraph.getAuth, { userId });
      if (!authRecord?.accessToken) {
        throw new Error("No Crate page set up yet. Use setup_page first.");
      }

      const contentNodes = markdownToNodes(args.content);

      const pageResp = await telegraphCall("createPage", {
        access_token: authRecord.accessToken,
        title: args.title,
        content: JSON.stringify(contentNodes),
        author_name: authRecord.authorName || "Crate Digger",
        return_content: false,
      });
      if (!pageResp.ok || !pageResp.result?.path) {
        throw new Error(`Failed to create entry page: ${pageResp.error ?? "unknown error"}`);
      }

      const entryPath = pageResp.result.path as string;
      const entryUrl = pageResp.result.url as string;

      await convex.mutation(api.telegraph.addEntry, {
        userId,
        title: args.title,
        telegraphPath: entryPath,
        telegraphUrl: entryUrl,
        category: args.category,
      });

      await rebuildIndex(convex, userId);

      return toolResult({
        status: "published",
        url: entryUrl,
        title: args.title,
        category: args.category ?? null,
        index_url: authRecord.indexPagePath
          ? `https://telegra.ph/${authRecord.indexPagePath}`
          : undefined,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const viewMyPageHandler = async () => {
    try {
      const authRecord = await convex.query(api.telegraph.getAuth, { userId });
      if (!authRecord?.indexPagePath) {
        return toolResult({
          status: "not_setup",
          message: "No Crate page set up yet. Use setup_page to create one.",
        });
      }

      const entries = await convex.query(api.telegraph.listEntries, { userId });

      return toolResult({
        url: `https://telegra.ph/${authRecord.indexPagePath}`,
        author_name: authRecord.authorName,
        total_entries: entries.length,
        recent_entries: entries.slice(0, 20).map((e) => ({
          id: e._id,
          title: e.title,
          url: e.telegraphUrl,
          category: e.category,
          created_at: e.createdAt,
        })),
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const listEntriesHandler = async (args: {
    category?: string;
    limit?: number;
  }) => {
    try {
      const entries = await convex.query(api.telegraph.listEntries, {
        userId,
        category: args.category,
      });

      const limited = entries.slice(0, args.limit ?? 50);

      return toolResult({
        entries: limited.map((e) => ({
          id: e._id,
          title: e.title,
          url: e.telegraphUrl,
          category: e.category,
          created_at: e.createdAt,
        })),
        count: limited.length,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const deleteEntryHandler = async (args: { entry_id: string }) => {
    try {
      await convex.mutation(api.telegraph.removeEntry, {
        entryId: args.entry_id as Id<"telegraphEntries">,
      });

      await rebuildIndex(convex, userId);

      return toolResult({
        status: "removed",
        id: args.entry_id,
        note: "Entry removed from index. The Telegraph page itself cannot be deleted but is no longer linked.",
      });
    } catch (error) {
      return toolError(error);
    }
  };

  return [
    {
      name: "setup_page",
      description:
        "Create your Crate social page on Telegraph. One-time setup that returns a shareable URL. Idempotent — returns existing page if already set up.",
      inputSchema: {
        author_name: z
          .string()
          .max(128)
          .optional()
          .describe("Display name for your page (default: 'Crate Digger')"),
      },
      handler: setupPageHandler,
    },
    {
      name: "post_to_page",
      description:
        "Publish a new entry to your Crate social page. Content is markdown (headings, bold, italic, links, lists, blockquotes). The entry gets its own page and is linked from your index.",
      inputSchema: {
        title: z.string().max(256).describe("Entry title"),
        content: z.string().describe("Entry content in markdown format"),
        category: z
          .enum(["influence", "artist", "playlist", "collection", "note"])
          .optional()
          .describe("Entry category shown on index page"),
      },
      handler: postToPageHandler,
    },
    {
      name: "view_my_page",
      description:
        "Get your Crate social page URL, entry count, and recent entries.",
      inputSchema: {},
      handler: viewMyPageHandler,
    },
    {
      name: "list_entries",
      description:
        "List all published entries on your Crate page. Optionally filter by category.",
      inputSchema: {
        category: z
          .enum(["influence", "artist", "playlist", "collection", "note"])
          .optional()
          .describe("Filter by entry category"),
        limit: z.number().optional().describe("Max entries to return (default 50)"),
      },
      handler: listEntriesHandler,
    },
    {
      name: "delete_entry",
      description:
        "Remove an entry from your Crate page index. The Telegraph page still exists but is unlinked from your index.",
      inputSchema: {
        entry_id: z.string().describe("Entry ID to remove"),
      },
      handler: deleteEntryHandler,
    },
  ];
}

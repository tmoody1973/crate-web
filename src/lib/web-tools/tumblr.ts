/**
 * Web-specific Tumblr tool handlers.
 * Uses Convex (via ConvexHttpClient) instead of SQLite for persistence.
 * Ported from crate-cli/dist/servers/tumblr.js.
 *
 * Note: connect_tumblr requires a browser OAuth flow which is handled
 * separately via Settings UI — not as an agent tool on the web.
 */

import crypto from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const TUMBLR_API = "https://api.tumblr.com/v2";

// ── OAuth 1.0a signing ────────────────────────────────────────────

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function hmacSha1(key: string, data: string): string {
  return crypto.createHmac("sha1", key).update(data).digest("base64");
}

function buildBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join("&");
  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sorted)}`;
}

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = "",
): string {
  const baseString = buildBaseString(method, url, params);
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return hmacSha1(signingKey, baseString);
}

function oauthHeader(params: Record<string, string>): string {
  const parts = Object.keys(params)
    .filter((k) => k.startsWith("oauth_"))
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k]!)}"`);
  return `OAuth ${parts.join(", ")}`;
}

// ── Tumblr API helper ─────────────────────────────────────────────

async function tumblrApi(
  method: string,
  path: string,
  body: unknown,
  consumerKey: string,
  consumerSecret: string,
  oauthToken: string,
  oauthTokenSecret: string,
): Promise<{ meta: { status: number }; response: Record<string, unknown> }> {
  const url = `${TUMBLR_API}${path}`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_token: oauthToken,
    oauth_version: "1.0",
  };

  oauthParams.oauth_signature = oauthSign(
    method,
    url,
    oauthParams,
    consumerSecret,
    oauthTokenSecret,
  );

  const headers: Record<string, string> = {
    Authorization: oauthHeader(oauthParams),
  };

  const fetchOpts: RequestInit = { method, headers };
  if (body && method !== "GET") {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);
  return (await res.json()) as {
    meta: { status: number };
    response: Record<string, unknown>;
  };
}

// ── Markdown → Tumblr NPF ────────────────────────────────────────

interface NpfFormatting {
  start: number;
  end: number;
  type: string;
  url?: string;
}

interface NpfBlock {
  type: string;
  subtype?: string;
  text: string;
  formatting?: NpfFormatting[];
}

function parseInlineFormatting(text: string): {
  plainText: string;
  formatting: NpfFormatting[];
} {
  const formatting: NpfFormatting[] = [];
  let plain = "";
  const re =
    /`([^`]+?)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      plain += text.slice(lastIndex, match.index);
    }
    const start = plain.length;
    if (match[1] !== undefined) {
      plain += match[1];
      formatting.push({ start, end: plain.length, type: "small" });
    } else if (match[2] !== undefined) {
      plain += match[2];
      formatting.push({ start, end: plain.length, type: "bold" });
    } else if (match[3] !== undefined) {
      plain += match[3];
      formatting.push({ start, end: plain.length, type: "italic" });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      plain += match[4];
      formatting.push({ start, end: plain.length, type: "link", url: match[5] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    plain += text.slice(lastIndex);
  }
  return { plainText: plain, formatting };
}

/** Sanitize content for Tumblr NPF — strip unicode symbols and normalize characters. */
function sanitizeForTumblr(text: string): string {
  return text
    // Replace common unicode arrows with plain text
    .replace(/[→⟶⇒➜➔►▶]/g, "->")
    .replace(/[←⟵⇐◄◀]/g, "<-")
    .replace(/[↔⟷⇔]/g, "<->")
    // Replace filled/empty circles (strength indicators) with text
    .replace(/●/g, "*")
    .replace(/○/g, "-")
    // Replace common emoji with text equivalents
    .replace(/🎵/g, "[music]")
    .replace(/🎧/g, "[headphones]")
    .replace(/🎶/g, "[notes]")
    .replace(/🌍/g, "[globe]")
    .replace(/🎉/g, "")
    .replace(/📝/g, "")
    // Strip remaining emoji (basic range)
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();
}

/** Convert a markdown table into NPF list items (since NPF has no table type). */
function tableToNpfBlocks(lines: string[], startIdx: number): { blocks: NpfBlock[]; consumed: number } {
  const blocks: NpfBlock[] = [];
  let i = startIdx;

  // Parse header row
  const headerLine = lines[i]!;
  const headers = headerLine.split("|").map((c) => c.trim()).filter(Boolean);

  // Skip separator row (|---|---|---|)
  i++;
  if (i < lines.length && /^\|?[\s\-:|]+\|/.test(lines[i]!)) {
    i++;
  }

  // Parse data rows as list items: "Header1: Value1, Header2: Value2"
  while (i < lines.length && lines[i]!.includes("|") && !lines[i]!.match(/^#{1,6}\s/)) {
    const cells = lines[i]!.split("|").map((c) => c.trim()).filter(Boolean);
    const parts = headers
      .map((h, idx) => cells[idx] ? `${h}: ${cells[idx]}` : "")
      .filter(Boolean);
    const rowText = sanitizeForTumblr(parts.join(" | "));
    if (rowText) {
      blocks.push({ type: "text", subtype: "unordered-list-item", text: rowText });
    }
    i++;
  }

  return { blocks, consumed: i - startIdx };
}

export function markdownToNpf(text: string): NpfBlock[] {
  const blocks: NpfBlock[] = [];
  const sanitized = sanitizeForTumblr(text);
  const lines = sanitized.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") { i++; continue; }
    if (/^---+$/.test(line.trim())) { i++; continue; }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      const { plainText, formatting } = parseInlineFormatting(h2Match[1]!);
      const block: NpfBlock = { type: "text", subtype: "heading1", text: plainText };
      if (formatting.length > 0) block.formatting = formatting;
      blocks.push(block);
      i++; continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      const { plainText, formatting } = parseInlineFormatting(h3Match[1]!);
      const block: NpfBlock = { type: "text", subtype: "heading2", text: plainText };
      if (formatting.length > 0) block.formatting = formatting;
      blocks.push(block);
      i++; continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]?.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      const { plainText, formatting } = parseInlineFormatting(quoteLines.join("\n"));
      const block: NpfBlock = { type: "text", subtype: "quote", text: plainText };
      if (formatting.length > 0) block.formatting = formatting;
      blocks.push(block);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        const itemText = (lines[i] ?? "").replace(/^[-*]\s+/, "");
        const { plainText, formatting } = parseInlineFormatting(itemText);
        const block: NpfBlock = { type: "text", subtype: "unordered-list-item", text: plainText };
        if (formatting.length > 0) block.formatting = formatting;
        blocks.push(block);
        i++;
      }
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        const itemText = (lines[i] ?? "").replace(/^\d+\.\s+/, "");
        const { plainText, formatting } = parseInlineFormatting(itemText);
        const block: NpfBlock = { type: "text", subtype: "ordered-list-item", text: plainText };
        if (formatting.length > 0) block.formatting = formatting;
        blocks.push(block);
        i++;
      }
      continue;
    }

    // Markdown table (line has | characters and next line is separator)
    if (line.includes("|") && i + 1 < lines.length && /^\|?[\s\-:|]+\|/.test(lines[i + 1] ?? "")) {
      const { blocks: tableBlocks, consumed } = tableToNpfBlocks(lines, i);
      blocks.push(...tableBlocks);
      i += consumed;
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
      blocks.push({ type: "text", subtype: "indented", text: codeLines.join("\n") });
      continue;
    }

    const { plainText, formatting } = parseInlineFormatting(line);
    const block: NpfBlock = { type: "text", text: plainText };
    if (formatting.length > 0) block.formatting = formatting;
    blocks.push(block);
    i++;
  }

  return blocks;
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

export function createTumblrTools(
  convexUrl: string,
  userId: Id<"users">,
  consumerKey: string,
  consumerSecret: string,
): CrateToolDef[] {
  const convex = new ConvexHttpClient(convexUrl);

  const postToTumblrHandler = async (args: {
    title: string;
    content: string;
    tags?: string[];
    category?: string;
  }) => {
    try {
      const authRecord = await convex.query(api.tumblr.getAuth, { userId });
      if (!authRecord) {
        throw new Error(
          "Not connected to Tumblr. Connect your Tumblr blog in Settings first.",
        );
      }

      const npfBlocks = markdownToNpf(args.content);
      const contentBlocks = [
        { type: "text", subtype: "heading1", text: args.title },
        ...npfBlocks,
      ];

      const tags = [...(args.tags ?? [])];
      if (args.category && !tags.includes(args.category)) {
        tags.unshift(args.category);
      }
      tags.push("crate", "music");

      const postData = await tumblrApi(
        "POST",
        `/blog/${authRecord.blogUuid}/posts`,
        { content: contentBlocks, tags: tags.join(","), state: "published" },
        consumerKey,
        consumerSecret,
        authRecord.oauthToken,
        authRecord.oauthTokenSecret,
      );

      const postId = String(
        (postData.response?.id as string | number) ?? "unknown",
      );
      const postUrl = `https://${authRecord.blogName}.tumblr.com/post/${postId}`;

      await convex.mutation(api.tumblr.addPost, {
        userId,
        tumblrPostId: postId,
        title: args.title,
        blogName: authRecord.blogName,
        postUrl,
        category: args.category,
        tags: JSON.stringify(tags),
      });

      return toolResult({
        status: "published",
        post_url: postUrl,
        tumblr_post_id: postId,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const tumblrBlogInfoHandler = async () => {
    try {
      const authRecord = await convex.query(api.tumblr.getAuth, { userId });
      if (!authRecord) {
        return toolResult({
          status: "not_connected",
          message: "Not connected to Tumblr. Connect in Settings first.",
        });
      }

      const recentPosts = await convex.query(api.tumblr.listPosts, { userId });

      return toolResult({
        blog_name: authRecord.blogName,
        blog_url: authRecord.blogUrl,
        post_count: recentPosts.length,
        recent_posts: recentPosts.map((p) => ({
          id: p._id,
          tumblr_post_id: p.tumblrPostId,
          title: p.title,
          post_url: p.postUrl,
          category: p.category,
          tags: p.tags ? JSON.parse(p.tags) : [],
          created_at: p.createdAt,
        })),
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const tumblrStatusHandler = async () => {
    try {
      const authRecord = await convex.query(api.tumblr.getAuth, { userId });
      if (!authRecord) {
        return toolResult({ connected: false });
      }
      return toolResult({
        connected: true,
        blog_name: authRecord.blogName,
        blog_url: authRecord.blogUrl,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const disconnectTumblrHandler = async () => {
    try {
      const authRecord = await convex.query(api.tumblr.getAuth, { userId });
      if (!authRecord) {
        return toolResult({
          status: "not_connected",
          message: "Already disconnected.",
        });
      }
      await convex.mutation(api.tumblr.removeAuth, { userId });
      return toolResult({
        status: "disconnected",
        blog_name: authRecord.blogName,
        note: "Credentials removed. Post history is preserved.",
      });
    } catch (error) {
      return toolError(error);
    }
  };

  return [
    {
      name: "post_to_tumblr",
      description:
        "Publish a post to your Tumblr blog. Content is markdown (headings, bold, italic, links, lists, blockquotes, code). Converted to Tumblr NPF format.",
      inputSchema: {
        title: z.string().max(256).describe("Post title"),
        content: z.string().describe("Post content in markdown format"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Tags for the post"),
        category: z
          .enum(["influence", "artist", "playlist", "collection", "note"])
          .optional()
          .describe("Category tag (auto-added to tags)"),
      },
      handler: postToTumblrHandler,
    },
    {
      name: "tumblr_blog_info",
      description: "Get your Tumblr blog details and recent posts.",
      inputSchema: {},
      handler: tumblrBlogInfoHandler,
    },
    {
      name: "tumblr_status",
      description: "Check if Tumblr is connected.",
      inputSchema: {},
      handler: tumblrStatusHandler,
    },
    {
      name: "disconnect_tumblr",
      description:
        "Remove stored Tumblr credentials. Post history is preserved.",
      inputSchema: {},
      handler: disconnectTumblrHandler,
    },
  ];
}

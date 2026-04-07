/**
 * Tumblr connected tools powered by Auth0 Token Vault.
 * Read dashboard, tagged posts, likes — and publish posts — requires user to connect Tumblr via OAuth.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import { markdownToNpf } from "@/lib/web-tools/tumblr";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const TUMBLR_API = "https://api.tumblr.com/v2";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// ── Post normalization ────────────────────────────────────────────

interface TumblrPost {
  type: string;
  id: string | number;
  blog_name: string;
  blog?: { url?: string };
  post_url?: string;
  timestamp?: number;
  date?: string;
  tags?: string[];
  note_count?: number;
  summary?: string;
  // audio fields
  artist?: string;
  source_title?: string;
  track_name?: string;
  album?: string;
  album_art?: string;
  plays?: number;
  source_url?: string;
  // text fields
  title?: string;
  body?: string;
  // photo fields
  caption?: string;
  photos?: Array<{ original_size?: { url?: string } }>;
  // link fields
  url?: string;
  description?: string;
  // video fields
  video_url?: string;
  thumbnail_url?: string;
  // quote fields
  text?: string;
  source?: string;
}

interface NormalizedPost {
  type: string;
  id: string;
  blog_name: string;
  blog_url: string | undefined;
  post_url: string | undefined;
  timestamp: number | undefined;
  date: string | undefined;
  tags: string[];
  note_count: number | undefined;
  summary: string | undefined;
  // type-specific fields (optional)
  artist?: string;
  track_name?: string;
  album?: string;
  album_art?: string;
  plays?: number;
  external_url?: string;
  title?: string;
  body_excerpt?: string;
  image_url?: string;
  url?: string;
  description?: string;
  caption?: string;
  video_url?: string;
  thumbnail_url?: string;
  text?: string;
  source?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function normalizePost(post: TumblrPost): NormalizedPost {
  const base: NormalizedPost = {
    type: post.type,
    id: String(post.id),
    blog_name: post.blog_name,
    blog_url: post.blog?.url,
    post_url: post.post_url,
    timestamp: post.timestamp,
    date: post.date,
    tags: post.tags ?? [],
    note_count: post.note_count,
    summary: post.summary,
  };

  switch (post.type) {
    case "audio":
      return {
        ...base,
        artist: post.artist ?? post.source_title,
        track_name: post.track_name,
        album: post.album,
        album_art: post.album_art,
        plays: post.plays,
        external_url: post.source_url,
      };
    case "text":
      return {
        ...base,
        title: post.title,
        body_excerpt: post.body ? stripHtml(post.body).slice(0, 300) : undefined,
      };
    case "photo":
      return {
        ...base,
        caption: post.caption ? stripHtml(post.caption).slice(0, 300) : undefined,
        image_url: post.photos?.[0]?.original_size?.url,
      };
    case "link":
      return {
        ...base,
        title: post.title,
        url: post.url,
        description: post.description ? stripHtml(post.description).slice(0, 200) : undefined,
      };
    case "video":
      return {
        ...base,
        caption: post.caption ? stripHtml(post.caption).slice(0, 200) : undefined,
        video_url: post.video_url,
        thumbnail_url: post.thumbnail_url,
      };
    case "quote":
      return {
        ...base,
        text: post.text,
        source: post.source,
      };
    default:
      return base;
  }
}

// ── Tool factory ──────────────────────────────────────────────────

export function createTumblrConnectedTools(auth0UserId?: string): CrateToolDef[] {
  return [
    {
      name: "read_tumblr_blog",
      description:
        "Read posts from a specific Tumblr blog. If blog_name is omitted, lists the user's blogs so they can choose. Use this as the default /tumblr command — shows the user's own blog content.",
      inputSchema: {
        blog_name: z.string().optional().describe("Blog name to read (e.g. 'tarik-crate'). Omit to list available blogs."),
        limit: z.number().optional().describe("Number of posts to return (default 20, max 50)"),
      },
      handler: async (args: { blog_name?: string; limit?: number }) => {
        const token = await getTokenVaultToken("tumblr", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
            action: "connect_tumblr",
          });
        }

        try {
          // If no blog specified, list available blogs
          if (!args.blog_name) {
            const infoRes = await fetch(`${TUMBLR_API}/user/info`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!infoRes.ok) {
              return toolResult({ error: `Tumblr API error: ${infoRes.status}` });
            }
            const infoData = await infoRes.json();
            const blogs = (infoData.response?.user?.blogs ?? []).map((b: { name: string; title: string; url: string; primary: boolean; posts: number }) => ({
              name: b.name,
              title: b.title,
              url: b.url,
              primary: b.primary,
              posts: b.posts,
            }));
            return toolResult({
              action: "choose_blog",
              message: "Ask the user which blog to read. Then call read_tumblr_blog again with blog_name.",
              blogs,
            });
          }

          const limit = Math.min(args.limit ?? 20, 50);
          const res = await fetch(`${TUMBLR_API}/blog/${args.blog_name}/posts?limit=${limit}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
          }

          const data = await res.json();
          const posts: TumblrPost[] = data.response?.posts ?? [];

          return toolResult({
            source: "blog",
            blog_name: args.blog_name,
            total: posts.length,
            posts: posts.map(normalizePost),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Tumblr blog request failed" });
        }
      },
    },

    {
      name: "read_tumblr_dashboard",
      description:
        "Read posts from the user's Tumblr dashboard — the feed of posts from all blogs they follow. Returns all post types (audio, text, photo, link, video, quote). Great for discovering music and content from curated blogs.",
      inputSchema: {
        limit: z.number().optional().describe("Number of posts to return (default 20, max 50)"),
      },
      handler: async (args: { limit?: number }) => {
        const token = await getTokenVaultToken("tumblr", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
            action: "connect_tumblr",
          });
        }

        const limit = Math.min(args.limit ?? 20, 50);

        try {
          const res = await fetch(`${TUMBLR_API}/user/dashboard?limit=${limit}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
          }

          const data = await res.json();
          const posts: TumblrPost[] = data.response?.posts ?? [];

          return toolResult({
            source: "dashboard",
            total: posts.length,
            posts: posts.map(normalizePost),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Tumblr dashboard request failed" });
        }
      },
    },

    {
      name: "read_tumblr_tagged",
      description:
        "Discover Tumblr posts by tag — great for tag-based music discovery (e.g. 'jazz', 'hip-hop', 'vinyl', 'producer'). Returns all post types from anyone on Tumblr using that tag. Use the 'before' param for pagination.",
      inputSchema: {
        tag: z.string().describe("Tag to search (without #, e.g. 'jazz' or 'hip-hop')"),
        before: z.number().optional().describe("Unix timestamp — return posts before this time (for pagination)"),
      },
      handler: async (args: { tag: string; before?: number }) => {
        const token = await getTokenVaultToken("tumblr", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
            action: "connect_tumblr",
          });
        }

        // Strip leading # if present
        const tag = args.tag.replace(/^#/, "");
        let url = `${TUMBLR_API}/tagged?tag=${encodeURIComponent(tag)}`;
        if (args.before !== undefined) {
          url += `&before=${args.before}`;
        }

        try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
          }

          const data = await res.json();
          // /tagged returns response as array directly
          const posts: TumblrPost[] = Array.isArray(data.response) ? data.response : [];

          return toolResult({
            source: "tagged",
            tag,
            total: posts.length,
            posts: posts.map(normalizePost),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Tumblr tagged request failed" });
        }
      },
    },

    {
      name: "read_tumblr_likes",
      description:
        "Read posts the user has liked on Tumblr. Useful for reviewing saved music content and curated discoveries.",
      inputSchema: {
        limit: z.number().optional().describe("Number of liked posts to return (default 20, max 50)"),
      },
      handler: async (args: { limit?: number }) => {
        const token = await getTokenVaultToken("tumblr", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
            action: "connect_tumblr",
          });
        }

        const limit = Math.min(args.limit ?? 20, 50);

        try {
          const res = await fetch(`${TUMBLR_API}/user/likes?limit=${limit}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
          }

          const data = await res.json();
          const posts: TumblrPost[] = data.response?.liked_posts ?? [];
          const total: number = data.response?.liked_count ?? posts.length;

          return toolResult({
            source: "likes",
            total,
            posts: posts.map(normalizePost),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Tumblr likes request failed" });
        }
      },
    },

    {
      name: "post_to_tumblr",
      description:
        "Publish a post to the user's Tumblr blog. Content is markdown — converted to Tumblr NPF format. Auto-tags with 'crate' and 'music'. If blog_name is omitted, returns the list of available blogs so you can ask the user which one to post to. Always call without blog_name first to get the list, then call again with the user's chosen blog_name.",
      inputSchema: {
        title: z.string().max(256).describe("Post title"),
        content: z.string().describe("Post content in markdown format"),
        tags: z.array(z.string()).optional().describe("Tags for the post"),
        category: z
          .enum(["influence", "artist", "playlist", "collection", "note"])
          .optional()
          .describe("Category tag (auto-added to tags)"),
        blog_name: z.string().optional().describe("Blog name to post to (e.g. 'tarik-crate'). If omitted, lists available blogs so the user can choose."),
      },
      handler: async (args: {
        title: string;
        content: string;
        tags?: string[];
        category?: string;
        blog_name?: string;
      }) => {
        const token = await getTokenVaultToken("tumblr", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
            action: "connect_tumblr",
          });
        }

        try {
          // Step 1: Get the user's blogs
          const infoRes = await fetch(`${TUMBLR_API}/user/info`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!infoRes.ok) {
            const detail = await infoRes.text().catch(() => "");
            return toolResult({ error: `Failed to get Tumblr user info: ${infoRes.status}`, detail });
          }

          const infoData = await infoRes.json();
          const blogs: Array<{ name: string; title: string; url: string; primary: boolean }> =
            infoData.response?.user?.blogs ?? [];

          if (blogs.length === 0) {
            return toolResult({ error: "No blogs found on this Tumblr account" });
          }

          // If no blog_name specified, list available blogs so agent can ask user
          if (!args.blog_name) {
            return toolResult({
              action: "choose_blog",
              message: "Multiple blogs available. Ask the user which blog to post to.",
              blogs: blogs.map((b) => ({
                name: b.name,
                title: b.title,
                url: b.url,
                primary: b.primary,
              })),
            });
          }

          // Validate the chosen blog exists on this account
          const blogName = blogs.find((b) => b.name === args.blog_name)?.name;
          if (!blogName) {
            return toolResult({
              error: `Blog "${args.blog_name}" not found. Available blogs: ${blogs.map((b) => b.name).join(", ")}`,
              blogs: blogs.map((b) => b.name),
            });
          }

          // Step 2: Build NPF content
          const npfBlocks = markdownToNpf(args.content);
          const contentBlocks = [
            { type: "text", subtype: "heading1", text: args.title },
            ...npfBlocks,
          ];

          // Step 3: Build tags (category first, then user tags, then auto-tags)
          const tags = [...(args.tags ?? [])];
          if (args.category && !tags.includes(args.category)) {
            tags.unshift(args.category);
          }
          if (!tags.includes("crate")) tags.push("crate");
          if (!tags.includes("music")) tags.push("music");

          // Step 4: Publish the post
          const postRes = await fetch(`${TUMBLR_API}/blog/${blogName}/posts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: contentBlocks,
              tags: tags.join(","),
              state: "published",
            }),
          });

          if (!postRes.ok) {
            const detail = await postRes.text().catch(() => "");
            return toolResult({ error: `Failed to publish post: ${postRes.status}`, detail });
          }

          // Parse response as text first to preserve large post IDs
          // (Tumblr IDs are 64-bit ints that exceed JS Number.MAX_SAFE_INTEGER)
          const postText = await postRes.text();
          console.log("[tumblr] post response:", postText.slice(0, 500));

          // Try multiple patterns to find the post ID
          // Tumblr v2 NPF response: {"meta":{"status":201,"msg":"Created"},"response":{"id":"770123456789012345"}}
          // or: {"meta":{"status":201},"response":{"id":770123456789012345}}
          const stringIdMatch = postText.match(/"id"\s*:\s*"(\d+)"/);
          const numIdMatch = postText.match(/"id"\s*:\s*(\d{10,})/);
          const postId = stringIdMatch?.[1] ?? numIdMatch?.[1] ?? "unknown";
          // Tumblr supports both URL formats — use the modern one
          const postUrl = postId !== "unknown"
            ? `https://www.tumblr.com/${blogName}/${postId}`
            : `https://www.tumblr.com/${blogName}`;

          console.log("[tumblr] extracted postId:", postId, "url:", postUrl);

          return toolResult({
            status: "published",
            post_url: postUrl,
            tumblr_post_id: postId,
            blog_name: blogName,
            tags,
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Tumblr post failed" });
        }
      },
    },
  ];
}

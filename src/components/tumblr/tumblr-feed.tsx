"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────

export interface TumblrPost {
  type: string;
  id: string;
  blog_name: string;
  blog_url?: string;
  post_url?: string;
  timestamp?: number;
  date?: string;
  tags: string[];
  note_count?: number;
  summary?: string;
  // audio
  artist?: string;
  track_name?: string;
  album?: string;
  album_art?: string;
  plays?: number;
  external_url?: string;
  // text
  title?: string;
  body_excerpt?: string;
  // photo
  image_url?: string;
  caption?: string;
  // link
  url?: string;
  description?: string;
  // video
  video_url?: string;
  thumbnail_url?: string;
  // quote
  text?: string;
  source?: string;
}

export interface TumblrFeedProps {
  posts: TumblrPost[];
  source: "dashboard" | "tagged" | "likes";
  totalCount: number;
  tag?: string;
  onAction?: (action: string, data: unknown) => void;
}

// ── Constants ─────────────────────────────────────────────────────

type PostType = "all" | "audio" | "text" | "photo" | "link" | "video" | "quote";

const POST_TYPES: PostType[] = ["all", "audio", "text", "photo", "link", "video", "quote"];

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  audio: { label: "Audio", className: "bg-purple-900/50 text-purple-300 border border-purple-700/50" },
  text:  { label: "Text",  className: "bg-blue-900/50 text-blue-300 border border-blue-700/50" },
  photo: { label: "Photo", className: "bg-green-900/50 text-green-300 border border-green-700/50" },
  link:  { label: "Link",  className: "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50" },
  video: { label: "Video", className: "bg-red-900/50 text-red-300 border border-red-700/50" },
  quote: { label: "Quote", className: "bg-orange-900/50 text-orange-300 border border-orange-700/50" },
};

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(timestamp?: number, date?: string): string {
  const ts = timestamp ? timestamp * 1000 : date ? new Date(date).getTime() : 0;
  if (!ts) return "";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function sourceLabel(source: TumblrFeedProps["source"], tag?: string): string {
  if (source === "tagged") return tag ? `#${tag}` : "Tagged";
  if (source === "likes") return "Liked Posts";
  return "Dashboard";
}

// ── Sub-renderers ─────────────────────────────────────────────────

function AudioBody({ post }: { post: TumblrPost }) {
  return (
    <div className="flex items-start gap-3">
      {post.album_art && (
        <img
          src={post.album_art}
          alt={post.album ?? "Album art"}
          className="h-16 w-16 rounded-md object-cover shrink-0 border border-zinc-700"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="min-w-0 flex-1">
        {post.artist && (
          <p className="text-sm font-semibold text-white truncate">{post.artist}</p>
        )}
        {post.track_name && (
          <p className="text-sm text-zinc-300 truncate">{post.track_name}</p>
        )}
        {post.album && (
          <p className="text-xs text-zinc-500 truncate">{post.album}</p>
        )}
        <div className="mt-1 flex items-center gap-3">
          {post.plays !== undefined && (
            <span className="text-xs text-zinc-500">{post.plays.toLocaleString()} plays</span>
          )}
          {post.external_url && (
            <a
              href={post.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              External link
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TextBody({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.title && (
        <p className="text-sm font-semibold text-white mb-1">{post.title}</p>
      )}
      {post.body_excerpt && (
        <p className="text-xs text-zinc-400 line-clamp-3">{post.body_excerpt}</p>
      )}
    </div>
  );
}

function PhotoBody({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.caption ?? "Photo"}
          className="w-full max-h-48 rounded-md object-cover border border-zinc-800"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {post.caption && (
        <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{post.caption}</p>
      )}
    </div>
  );
}

function LinkBody({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.title && post.url ? (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {post.title}
        </a>
      ) : post.title ? (
        <p className="text-sm font-semibold text-white">{post.title}</p>
      ) : null}
      {post.description && (
        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{post.description}</p>
      )}
    </div>
  );
}

function QuoteBody({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.text && (
        <blockquote className="border-l-2 border-cyan-600 pl-3 text-sm text-zinc-200 italic">
          {post.text}
        </blockquote>
      )}
      {post.source && (
        <p className="mt-1.5 text-xs text-zinc-500">— {post.source}</p>
      )}
    </div>
  );
}

function VideoBody({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.thumbnail_url && (
        <img
          src={post.thumbnail_url}
          alt={post.caption ?? "Video thumbnail"}
          className="w-full max-h-48 rounded-md object-cover border border-zinc-800"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {post.caption && (
        <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{post.caption}</p>
      )}
    </div>
  );
}

function PostBody({ post }: { post: TumblrPost }) {
  switch (post.type) {
    case "audio": return <AudioBody post={post} />;
    case "text":  return <TextBody post={post} />;
    case "photo": return <PhotoBody post={post} />;
    case "link":  return <LinkBody post={post} />;
    case "quote": return <QuoteBody post={post} />;
    case "video": return <VideoBody post={post} />;
    default:
      return post.summary ? (
        <p className="text-xs text-zinc-400 line-clamp-2">{post.summary}</p>
      ) : null;
  }
}

// ── Post card ─────────────────────────────────────────────────────

function PostCard({ post }: { post: TumblrPost }) {
  const badge = TYPE_BADGE[post.type];
  const visibleTags = post.tags.slice(0, 6);
  const ago = timeAgo(post.timestamp, post.date);

  return (
    <div className="border-b border-zinc-800 px-4 py-4 last:border-b-0 hover:bg-zinc-800/30 transition-colors">
      {/* Post header */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-zinc-300 truncate">{post.blog_name}</span>
          {badge && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-zinc-600">{ago}</span>
      </div>

      {/* Post body */}
      <div className="mb-2.5">
        <PostBody post={post} />
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-700"
            >
              #{tag}
            </span>
          ))}
          {post.tags.length > 6 && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 ring-1 ring-zinc-700">
              +{post.tags.length - 6} more
            </span>
          )}
        </div>
      )}

      {/* Footer: notes + link */}
      <div className="flex items-center justify-between gap-2">
        {post.note_count !== undefined && (
          <span className="text-[11px] text-zinc-600">
            {post.note_count.toLocaleString()} {post.note_count === 1 ? "note" : "notes"}
          </span>
        )}
        {post.post_url && (
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-cyan-500 hover:text-cyan-400 transition-colors ml-auto"
          >
            View on Tumblr ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export function TumblrFeed({ posts: rawPosts, source, totalCount, tag, onAction }: TumblrFeedProps) {
  // Defensive: ensure posts is an array and each post has required fields
  const posts = (Array.isArray(rawPosts) ? rawPosts : []).map((p) => ({
    ...p,
    type: p.type || "text",
    id: p.id || String(Math.random()),
    blog_name: p.blog_name || "unknown",
    tags: Array.isArray(p.tags) ? p.tags : [],
  }));
  const [activeFilter, setActiveFilter] = useState<PostType>("all");

  const typeCounts = POST_TYPES.reduce<Record<PostType, number>>(
    (acc, t) => {
      const count = t === "all" ? posts.length : posts.filter((p) => p.type === t).length;
      return { ...acc, [t]: count };
    },
    { all: 0, audio: 0, text: 0, photo: 0, link: 0, video: 0, quote: 0 },
  );

  const filteredPosts = activeFilter === "all"
    ? posts
    : posts.filter((p) => p.type === activeFilter);

  const audioPosts = posts.filter((p) => p.type === "audio");
  const hasAudio = audioPosts.length > 0;

  const label = sourceLabel(source, tag);

  function handleExportToSpotify() {
    if (onAction) {
      onAction("export_to_spotify", { posts: audioPosts });
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Tumblr icon */}
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-blue-400">
            <path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.999 0h3.517v6.114h4.801v3.633h-4.82v7.47c.016 1.001.375 2.371 2.207 2.371h.09c.631-.02 1.486-.205 1.936-.419l1.156 3.425c-.436.636-2.4 1.374-4.304 1.406z" />
          </svg>
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
            {totalCount} posts
          </span>
        </div>
        {hasAudio && (
          <button
            onClick={handleExportToSpotify}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-green-800/50 bg-green-900/30 px-2.5 py-1 text-[11px] text-green-400 hover:bg-green-900/50 hover:border-green-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Export to Spotify
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-zinc-800 bg-zinc-950/50 px-2 py-1.5 scrollbar-none">
        {POST_TYPES.map((t) => {
          const count = typeCounts[t];
          if (t !== "all" && count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setActiveFilter(t)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeFilter === t
                  ? "bg-cyan-900/60 text-cyan-300 ring-1 ring-cyan-700/50"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className={`ml-1 ${activeFilter === t ? "text-cyan-400" : "text-zinc-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Post list */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredPosts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No {activeFilter === "all" ? "" : activeFilter + " "}posts found.
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 bg-zinc-950/30 px-4 py-2 text-center">
        <span className="text-[10px] text-zinc-600">via Crate</span>
      </div>
    </div>
  );
}

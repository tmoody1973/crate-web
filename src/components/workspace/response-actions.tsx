"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { marked } from "marked";

interface ResponseActionsProps {
  content: string;
  slackEmail?: string;
  onSendMessage?: (message: string) => void;
}

type ActionStatus = "idle" | "sending" | "sent" | "error";

/** Slack button is only shown for these users. */
const SLACK_ALLOWED_EMAILS = ["tarikjmoody@gmail.com"];
const SLACK_ALLOWED_DOMAINS = ["radiomilwaukee.org"];

export function ResponseActions({
  content,
  slackEmail = "y3v9l8q1c8s3d4n6@88nine.slack.com",
  onSendMessage,
}: ResponseActionsProps) {
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const emailDomain = userEmail.split("@")[1] ?? "";
  const showSlack =
    SLACK_ALLOWED_EMAILS.includes(userEmail.toLowerCase()) ||
    SLACK_ALLOWED_DOMAINS.includes(emailDomain.toLowerCase());
  const [copied, setCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState<ActionStatus>("idle");
  const [slackStatus, setSlackStatus] = useState<ActionStatus>("idle");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showEmailInput) inputRef.current?.focus();
  }, [showEmailInput]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmail = async (to: string, status: ActionStatus, setStatus: (s: ActionStatus) => void) => {
    if (status === "sending") return;
    console.log("[ResponseActions] sendEmail called:", { to, contentLength: content?.length });
    setStatus("sending");
    try {
      // Build a clean subject from first line of content
      const firstLine = content.split("\n")[0].replace(/[#*_]/g, "").trim();
      const subject = firstLine.length > 80
        ? firstLine.slice(0, 77) + "..."
        : firstLine || "Crate Research";

      // Convert markdown to styled HTML for email clients
      const rawHtml = await marked.parse(content, { gfm: true, breaks: true });
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.6"><style>table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}h1,h2,h3{margin-top:24px;margin-bottom:8px}h1{font-size:24px;border-bottom:2px solid #eee;padding-bottom:8px}h2{font-size:20px}h3{font-size:16px}blockquote{border-left:4px solid #ddd;margin:16px 0;padding:8px 16px;color:#555}code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:0.9em}pre{background:#f5f5f5;padding:16px;border-radius:6px;overflow-x:auto}a{color:#2563eb}ul,ol{padding-left:24px}hr{border:none;border-top:1px solid #eee;margin:24px 0}</style>${rawHtml}<hr style="margin-top:32px"><p style="font-size:12px;color:#999">Sent from <a href="https://crate.fm" style="color:#999">Crate</a> — AI music research</p></body></html>`;

      console.log("[ResponseActions] fetching /api/email...");
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: `[Crate] ${subject}`,
          text: content,
          html,
        }),
      });
      const data = await res.json();
      console.log("[ResponseActions] response:", res.status, data);
      if (!res.ok) throw new Error(data.error);
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error("[ResponseActions] sendEmail error:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleSlack = () => sendEmail(slackEmail, slackStatus, setSlackStatus);

  const handleEmailSubmit = () => {
    if (!customEmail.trim()) return;
    sendEmail(customEmail.trim(), emailStatus, setEmailStatus);
    setShowEmailInput(false);
    setCustomEmail("");
  };

  return (
    <div className="mt-2 flex items-center gap-1">
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        title="Copy to clipboard"
      >
        {copied ? (
          <>
            <CheckIcon /> Copied
          </>
        ) : (
          <>
            <CopyIcon /> Copy
          </>
        )}
      </button>

      {/* Send to Slack — only for allowed users/domains */}
      {showSlack && (
        <button
          onClick={handleSlack}
          disabled={slackStatus === "sending"}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
          title="Send to Slack"
        >
          <SlackIcon />
          {slackStatus === "sending"
            ? "Sending..."
            : slackStatus === "sent"
              ? "Sent!"
              : slackStatus === "error"
                ? "Failed"
                : "Slack"}
        </button>
      )}

      {/* Email */}
      <div className="relative">
        <button
          onClick={() => setShowEmailInput(!showEmailInput)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          title="Email this response"
        >
          <EmailIcon />
          {emailStatus === "sending"
            ? "Sending..."
            : emailStatus === "sent"
              ? "Sent!"
              : emailStatus === "error"
                ? "Failed"
                : "Email"}
        </button>

        {showEmailInput && (
          <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1.5 shadow-xl">
            <input
              ref={inputRef}
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              placeholder="email@example.com"
              className="w-48 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <button
              onClick={handleEmailSubmit}
              disabled={!customEmail.trim()}
              className="rounded bg-white px-2 py-1 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Save to Google Docs */}
      {onSendMessage && (
        <button
          onClick={() => onSendMessage("Save the previous response to Google Docs")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          title="Save to Google Docs"
        >
          <GoogleDocsIcon /> Docs
        </button>
      )}

      {/* Post to Tumblr */}
      {onSendMessage && (
        <button
          onClick={() => onSendMessage("Post the previous response to Tumblr")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          title="Post to Tumblr"
        >
          <TumblrIcon /> Tumblr
        </button>
      )}

      {/* Share / Link */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        title="Share"
      >
        <ShareIcon /> Share
      </button>
    </div>
  );
}

// --- Inline SVG icons (14x14) ---

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
      <path d="M14 20.5c0-.83.67-1.5 1.5-1.5h0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h0c-.83 0-1.5-.67-1.5-1.5z" />
      <path d="M10 9.5C10 10.33 9.33 11 8.5 11h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
    </svg>
  );
}

function GoogleDocsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TumblrIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.999 0h3.517v6.114h4.801v3.633h-4.82v7.47c.016 1.001.375 2.371 2.207 2.371h.09c.631-.02 1.486-.205 1.936-.419l1.156 3.425c-.436.636-2.4 1.374-4.304 1.406z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

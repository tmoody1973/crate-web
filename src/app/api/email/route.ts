import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const CRATE_INBOX = "slack-rm@agentmail.to";
const AGENTMAIL_API = "https://api.agentmail.to/v0";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { to, subject, text, html } = await req.json();
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, and text or html" },
        { status: 400 },
      );
    }

    // Get user's AgentMail API key
    const user = await convex.query(api.users.getByClerkId, { clerkId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let agentmailKey = "";

    // Check user's personal keys
    if (user.encryptedKeys) {
      const keys: Record<string, string> = JSON.parse(
        decrypt(Buffer.from(new Uint8Array(user.encryptedKeys))),
      );
      if (keys.agentmail) agentmailKey = keys.agentmail;
    }

    // Fallback to org shared keys
    if (!agentmailKey) {
      const emailDomain = user.email?.split("@")[1] ?? "";
      if (emailDomain) {
        const orgRecord = await convex.query(api.orgKeys.getByDomain, {
          domain: emailDomain,
        });
        if (orgRecord?.encryptedKeys) {
          const orgKeys: Record<string, string> = JSON.parse(
            decrypt(Buffer.from(orgRecord.encryptedKeys)),
          );
          if (orgKeys.agentmail) agentmailKey = orgKeys.agentmail;
        }
      }
    }

    // Fallback to server-side env var (for team/embedded usage)
    if (!agentmailKey && process.env.AGENTMAIL_API_KEY) {
      agentmailKey = process.env.AGENTMAIL_API_KEY;
    }

    if (!agentmailKey) {
      return NextResponse.json(
        { error: "AgentMail API key not configured. Add one in Settings." },
        { status: 400 },
      );
    }

    // Send via AgentMail REST API directly (no SDK — avoids @x402/fetch dep)
    const recipients = Array.isArray(to) ? to : [to];
    const res = await fetch(`${AGENTMAIL_API}/inboxes/${CRATE_INBOX}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentmailKey}`,
      },
      body: JSON.stringify({
        to: recipients,
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[POST /api/email] AgentMail error:", res.status, errorBody);
      return NextResponse.json(
        { error: `AgentMail API error: ${res.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/email] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 },
    );
  }
}

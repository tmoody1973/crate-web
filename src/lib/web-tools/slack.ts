/**
 * Slack tool powered by Auth0 Token Vault.
 * Send research, show prep, or news segments to a Slack channel.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createSlackTools(auth0UserId?: string): CrateToolDef[] {
  const sendToSlackHandler = async (args: {
    channel: string;
    content: string;
    title?: string;
  }) => {
    const token = await getTokenVaultToken("slack", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Slack not connected. Ask the user to connect Slack in Settings.",
        action: "connect_slack",
      });
    }

    // Normalize channel name (add # if missing)
    const channel = args.channel.startsWith("#") ? args.channel.slice(1) : args.channel;

    const blocks = [];
    if (args.title) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: args.title },
      });
    }

    // Split content into chunks of 3000 chars (Slack block limit)
    const chunks = [];
    let remaining = args.content;
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, 3000));
      remaining = remaining.slice(3000);
    }

    for (const chunk of chunks) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: chunk },
      });
    }

    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          blocks,
          text: args.title || "Crate Research",
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        return toolResult({ error: `Slack API error: ${data.error}` });
      }

      return toolResult({
        success: true,
        channel: `#${channel}`,
        permalink: data.message?.permalink,
        message: `Sent to #${channel} on Slack!`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Slack send failed" });
    }
  };

  return [
    {
      name: "send_to_slack",
      description:
        "Send research results, show prep, or news segments to a Slack channel. Requires the user to have connected Slack in Settings. Use this when the user says 'send to Slack' or 'share with my team'.",
      inputSchema: {
        channel: z.string().describe("Slack channel name (e.g. '#hyfin-evening' or 'general')"),
        content: z.string().describe("Content to send (supports Slack markdown)"),
        title: z.string().optional().describe("Optional header for the message"),
      },
      handler: sendToSlackHandler,
    },
  ];
}

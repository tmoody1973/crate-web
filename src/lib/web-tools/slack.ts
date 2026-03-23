/**
 * Slack tools powered by Auth0 Token Vault.
 * List channels, send rich Block Kit messages to channels or DMs.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import { contentToBlocks } from "./slack-formatter";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// contentToBlocks imported from ./slack-formatter

export function createSlackTools(auth0UserId?: string): CrateToolDef[] {
  // List channels the user has access to
  const listChannelsHandler = async () => {
    const token = await getTokenVaultToken("slack", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Slack not connected. Ask the user to connect Slack in Settings.",
        action: "connect_slack",
      });
    }

    try {
      const res = await fetch(
        "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=100",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();

      if (!data.ok) {
        return toolResult({ error: `Slack API error: ${data.error}` });
      }

      const channels = (data.channels ?? []).map((ch: { name: string; id: string; is_member: boolean; num_members: number; purpose: { value: string } }) => ({
        name: `#${ch.name}`,
        id: ch.id,
        isMember: ch.is_member,
        members: ch.num_members,
        purpose: ch.purpose?.value?.slice(0, 100) || "",
      }));

      return toolResult({
        channels,
        total: channels.length,
        hint: "Use the channel name (e.g. #general) with send_to_slack. You can also send a DM by passing a username.",
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Failed to list channels" });
    }
  };

  // Send a message to a channel or DM
  const sendToSlackHandler = async (args: {
    channel: string;
    content: string;
    title?: string;
    format?: string;
  }) => {
    const token = await getTokenVaultToken("slack", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Slack not connected. Ask the user to connect Slack in Settings.",
        action: "connect_slack",
      });
    }

    let channelId = args.channel;

    // If it starts with # or looks like a name (not an ID), resolve it
    if (args.channel.startsWith("#") || args.channel.startsWith("@") || !args.channel.startsWith("C")) {
      const name = args.channel.replace(/^[#@]/, "");

      // Try to find as a channel first
      if (args.channel.startsWith("@")) {
        // DM: look up user by name, then open a conversation
        try {
          const usersRes = await fetch(
            "https://slack.com/api/users.list?limit=200",
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const usersData = await usersRes.json();
          if (usersData.ok) {
            const user = (usersData.members ?? []).find(
              (u: { name: string; real_name: string; deleted: boolean }) =>
                !u.deleted && (u.name.toLowerCase() === name.toLowerCase() ||
                  u.real_name?.toLowerCase() === name.toLowerCase()),
            );
            if (user) {
              // Open DM conversation
              const dmRes = await fetch("https://slack.com/api/conversations.open", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ users: user.id }),
              });
              const dmData = await dmRes.json();
              if (dmData.ok) {
                channelId = dmData.channel.id;
              } else {
                return toolResult({ error: `Could not open DM with ${name}: ${dmData.error}` });
              }
            } else {
              return toolResult({ error: `User "${name}" not found in Slack workspace` });
            }
          }
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Failed to find user" });
        }
      } else {
        // Channel: just use the name directly (Slack accepts channel names)
        channelId = name;
      }
    }

    // Build Block Kit message
    const blocks = contentToBlocks(args.content, args.title);

    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: channelId,
          blocks,
          text: args.title || "Crate Research",
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        console.error(`[slack] chat.postMessage failed:`, JSON.stringify(data));
        return toolResult({
          error: `Slack API error: ${data.error}`,
          detail: data.error === "channel_not_found" ? "Channel not found. The app may not have access." :
                  data.error === "not_in_channel" ? "The app is not in this channel. Invite it with /invite @YourApp" :
                  data.error === "invalid_auth" ? "Slack token expired or invalid. Try reconnecting Slack in Settings." :
                  data.error === "missing_scope" ? `Missing scope: ${data.needed}. Reconnect Slack to grant permissions.` :
                  undefined,
        });
      }

      console.log(`[slack] Message sent to ${channelId}, ts: ${data.ts}`);

      const displayChannel = args.channel.startsWith("@")
        ? `DM to ${args.channel}`
        : `#${channelId}`;

      return toolResult({
        success: true,
        channel: displayChannel,
        timestamp: data.ts,
        message: `Sent to ${displayChannel} on Slack!`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Slack send failed" });
    }
  };

  return [
    {
      name: "list_slack_channels",
      description:
        "ALWAYS call this FIRST when the user says 'send to Slack', 'share on Slack', or 'post to Slack' — even before send_to_slack. Returns channels the user can pick from. After getting results, render them using the SlackChannelPicker OpenUI component so the user can click to choose. NEVER ask the user to type a channel name.",
      inputSchema: {},
      handler: listChannelsHandler,
    },
    {
      name: "send_to_slack",
      description:
        "Send research results to a Slack channel or DM. Use '#channel-name' for channels or '@username' for DMs. Content is auto-formatted with Block Kit rich text. IMPORTANT: Always call list_slack_channels first and show SlackChannelPicker — never ask the user to type a channel name.",
      inputSchema: {
        channel: z.string().describe("Slack channel (#channel-name) or user (@username) to send to"),
        content: z.string().describe("Content to send — use markdown: ## for headers, - for bullets, --- for dividers, **bold** for emphasis"),
        title: z.string().optional().describe("Message header (displayed prominently at the top)"),
      },
      handler: sendToSlackHandler,
    },
  ];
}

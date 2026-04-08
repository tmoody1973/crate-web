/**
 * Google Docs tool powered by Auth0 Token Vault.
 * Save research output as shareable Google Docs.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createGoogleDocsTools(auth0UserId?: string): CrateToolDef[] {
  const saveToGoogleDocHandler = async (args: {
    title: string;
    content: string;
  }) => {
    const token = await getTokenVaultToken("google", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Google not connected. Ask the user to connect Google in Settings.",
        action: "connect_google",
      });
    }

    try {
      // Step 1: Create an empty doc
      const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: args.title }),
      });

      if (!createRes.ok) {
        const detail = await createRes.text().catch(() => "");
        return toolResult({ error: `Google Docs API error: ${createRes.status}`, detail });
      }

      const doc = await createRes.json();
      const docId = doc.documentId;

      // Step 2: Insert content
      await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: args.content,
              },
            },
          ],
        }),
      });

      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

      return toolResult({
        success: true,
        docUrl,
        docId,
        title: args.title,
        message: `Saved to Google Docs: ${docUrl}`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Google Docs save failed" });
    }
  };

  return [
    {
      name: "save_to_google_doc",
      description:
        "Save research output as a Google Doc. Creates a new document with the given title and content, returns a shareable link. Requires Google connection in Settings. IMPORTANT: Before calling this tool, confirm with the user: 'About to save to Google Docs with title [title]. Proceed?' Wait for confirmation before calling.",
      inputSchema: {
        title: z.string().describe("Document title (e.g. 'Flying Lotus Influence Chain')"),
        content: z.string().describe("Document content (plain text, will be inserted into the doc)"),
      },
      handler: saveToGoogleDocHandler,
    },
  ];
}

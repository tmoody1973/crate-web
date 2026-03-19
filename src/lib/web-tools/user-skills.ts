/**
 * Agent-callable tools for managing user custom skills.
 * Used during /create-skill flow and /skills listing.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createUserSkillTools(
  convexUrl: string,
  userId: Id<"users">,
  maxSkills: number,
): CrateToolDef[] {
  const convex = new ConvexHttpClient(convexUrl);

  const saveSkillHandler = async (args: {
    command: string;
    name: string;
    description: string;
    promptTemplate: string;
    toolHints: string[];
    sourceUrl?: string;
  }) => {
    const cmd = args.command.toLowerCase().replace(/^\//, "").replace(/[^a-z0-9-]/g, "");
    if (!cmd || cmd.length < 2 || cmd.length > 30) {
      return toolResult({ error: "Command must be 2-30 characters, lowercase letters, numbers, and hyphens only." });
    }

    try {
      const id = await convex.mutation(api.userSkills.create, {
        userId,
        command: cmd,
        name: args.name,
        description: args.description,
        promptTemplate: args.promptTemplate,
        toolHints: args.toolHints,
        sourceUrl: args.sourceUrl,
        maxSkills,
      });
      return toolResult({
        success: true,
        command: `/${cmd}`,
        name: args.name,
        id,
        message: `Skill saved! Type /${cmd} anytime to run it.`,
      });
    } catch (err) {
      return toolResult({
        error: err instanceof Error ? err.message : "Failed to save skill",
      });
    }
  };

  const listSkillsHandler = async (_args: Record<string, never>) => {
    const skills = await convex.query(api.userSkills.listByUser, { userId });
    if (skills.length === 0) {
      return toolResult({
        skills: [],
        message: "No custom skills yet. Use /create-skill to create one.",
      });
    }
    return toolResult({
      skills: skills.map((s) => ({
        command: `/${s.command}`,
        name: s.name,
        description: s.description,
        isEnabled: s.isEnabled,
        sourceUrl: s.sourceUrl ?? null,
        toolHints: s.toolHints,
      })),
      count: skills.length,
      limit: maxSkills,
    });
  };

  return [
    {
      name: "save_user_skill",
      description:
        "Save a custom skill as a reusable slash command for the user. Call this after a successful dry run to persist the skill. The command name should be lowercase with hyphens (e.g. 'rave-events').",
      inputSchema: {
        command: z.string().describe("Command name without slash (e.g. 'rave-events')"),
        name: z.string().describe("Human-readable name (e.g. 'The Rave Events')"),
        description: z.string().describe("One sentence describing what it does"),
        promptTemplate: z.string().describe("The full prompt that produced the successful dry run results"),
        toolHints: z.array(z.string()).describe("Tool names that worked during the dry run"),
        sourceUrl: z.string().optional().describe("URL if a website was involved"),
      },
      handler: saveSkillHandler,
    },
    {
      name: "list_user_skills",
      description: "List all custom skills the user has created. Shows command name, description, and status.",
      inputSchema: {},
      handler: listSkillsHandler,
    },
  ];
}

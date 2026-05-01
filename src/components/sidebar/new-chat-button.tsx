"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export function NewChatButton() {
  const router = useRouter();
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const createSession = useMutation(api.sessions.create);

  const handleNewChat = async () => {
    if (!user) return;
    const id = await createSession({ userId: user._id });
    router.push(`/w/${id}`);
  };

  return (
    <button
      onClick={handleNewChat}
      className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      New chat
    </button>
  );
}

"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

function WorkspaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId: clerkId } = useAuth();
  const { user: clerkUser } = useUser();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const upsertUser = useMutation(api.users.upsert);
  const createSession = useMutation(api.sessions.create);
  const creating = useRef(false);

  // Ensure user exists in Convex (webhook may not have fired yet)
  // Convex returns undefined while loading, null if not found
  useEffect(() => {
    if (!clerkId || !clerkUser || user !== null) return;
    upsertUser({
      clerkId,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
      name: clerkUser.fullName ?? undefined,
    });
  }, [clerkId, clerkUser, user, upsertUser]);

  // Once user exists, create session and redirect
  useEffect(() => {
    if (!user || creating.current) return;
    creating.current = true;
    createSession({ userId: user._id }).then((id) => {
      const prompt = searchParams.get("prompt");
      const qs = prompt ? `?prompt=${encodeURIComponent(prompt)}` : "";
      router.replace(`/w/${id}${qs}`);
    });
  }, [user, createSession, router, searchParams]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-zinc-500">Creating new session...</p>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <p className="text-zinc-500">Loading...</p>
        </div>
      }
    >
      <WorkspaceInner />
    </Suspense>
  );
}

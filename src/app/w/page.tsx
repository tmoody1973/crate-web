"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export default function WorkspacePage() {
  const router = useRouter();
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
      router.replace(`/w/${id}`);
    });
  }, [user, createSession, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-zinc-500">Creating new session...</p>
    </div>
  );
}

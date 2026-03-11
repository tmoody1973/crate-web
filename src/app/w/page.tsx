"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export default function WorkspacePage() {
  const router = useRouter();
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const createSession = useMutation(api.sessions.create);
  const creating = useRef(false);

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

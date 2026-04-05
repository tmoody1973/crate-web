"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCallback } from "react";

export function useSession() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string | undefined;

  const session = useQuery(
    api.sessions.get,
    sessionId ? { id: sessionId as Id<"sessions"> } : "skip",
  );

  const createSession = useMutation(api.sessions.create);
  const updateTitle = useMutation(api.sessions.updateTitle);
  const toggleStar = useMutation(api.sessions.toggleStar);
  const archiveSession = useMutation(api.sessions.archive);
  const assignToCrate = useMutation(api.sessions.assignToCrate);

  const newChat = useCallback(
    async (userId: Id<"users">) => {
      const id = await createSession({ userId });
      router.push(`/w/${id}`);
      return id;
    },
    [createSession, router],
  );

  return {
    sessionId: sessionId as Id<"sessions"> | undefined,
    session,
    newChat,
    updateTitle,
    toggleStar,
    archiveSession,
    assignToCrate,
  };
}

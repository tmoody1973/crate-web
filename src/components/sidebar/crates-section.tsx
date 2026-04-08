"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { SessionItem } from "./session-item";
import { Id } from "../../../convex/_generated/dataModel";

export function CratesSection() {
  const [expanded, setExpanded] = useState(true);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const crates = useQuery(api.crates.list, user ? { userId: user._id } : "skip");
  const createCrate = useMutation(api.crates.create);
  const toggleStar = useMutation(api.sessions.toggleStar);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (!crates) return null;

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    await createCrate({ userId: user._id, name: newName.trim() });
    setNewName("");
    setCreating(false);
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs font-semibold uppercase text-zinc-500"
        >
          Crates
          <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
        </button>
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          +
        </button>
      </div>
      {expanded && (
        <div className="mt-1">
          {creating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="mb-1"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => {
                  if (!newName.trim()) setCreating(false);
                }}
                placeholder="Crate name..."
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </form>
          )}
          {/* Hide "No crates yet" — empty sections clutter the sidebar */}
          {crates.map((crate) => (
            <CrateFolder key={crate._id} crateId={crate._id} name={crate.name} userId={user!._id} toggleStar={toggleStar} />
          ))}
        </div>
      )}
    </div>
  );
}

function CrateFolder({
  crateId,
  name,
  userId,
  toggleStar,
}: {
  crateId: Id<"crates">;
  name: string;
  userId: Id<"users">;
  toggleStar: any;
}) {
  const [open, setOpen] = useState(false);
  const sessions = useQuery(api.sessions.listByCrate, { userId, crateId });

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      >
        <span className="text-xs">{open ? "📂" : "📁"}</span>
        <span className="truncate">{name}</span>
        {sessions && sessions.length > 0 && (
          <span className="ml-auto text-[10px] text-zinc-600">{sessions.length}</span>
        )}
      </button>
      {open && sessions && (
        <div className="ml-4">
          {sessions.length === 0 ? (
            <p className="px-2 text-xs text-zinc-600">Empty</p>
          ) : (
            (sessions as any[]).map((s) => (
              <SessionItem
                key={s._id}
                id={s._id}
                title={s.title}
                isStarred={s.isStarred}
                onToggleStar={() => toggleStar({ id: s._id })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

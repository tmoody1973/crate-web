"use client";

import { useState, useEffect } from "react";

interface Skill {
  _id: string;
  command: string;
  name: string;
  description: string;
  isEnabled: boolean;
  promptTemplate: string;
  toolHints: string[];
  sourceUrl?: string;
}

export function SkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills?full=true")
      .then((r) => r.json())
      .then((data) => setSkills(data.skills ?? []))
      .catch((err) => console.error("Failed to load skills", err))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(skill: Skill) {
    try {
      const res = await fetch(`/api/skills/${skill._id}/toggle`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Toggle failed");
      setSkills((prev) =>
        prev.map((s) =>
          s._id === skill._id ? { ...s, isEnabled: !s.isEnabled } : s,
        ),
      );
    } catch (err) {
      console.error("Failed to toggle skill", err);
    }
  }

  async function handleSavePrompt(skill: Skill) {
    const promptTemplate = editPrompts[skill._id];
    if (promptTemplate === undefined) return;
    setSavingId(skill._id);
    try {
      const res = await fetch(`/api/skills/${skill._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTemplate }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSkills((prev) =>
        prev.map((s) =>
          s._id === skill._id ? { ...s, promptTemplate } : s,
        ),
      );
      setEditPrompts((prev) => {
        const next = { ...prev };
        delete next[skill._id];
        return next;
      });
    } catch (err) {
      console.error("Failed to save prompt template", err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(skillId: string) {
    setDeletingId(skillId);
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSkills((prev) => prev.filter((s) => s._id !== skillId));
      if (expandedId === skillId) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete skill", err);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
        Custom Skills
      </h3>

      {skills.length === 0 ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-sm text-zinc-400">
          No custom skills yet. Type{" "}
          <span className="font-mono text-amber-400">/create-skill</span> in
          chat to create one.
        </p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => {
            const isExpanded = expandedId === skill._id;
            const promptValue =
              editPrompts[skill._id] !== undefined
                ? editPrompts[skill._id]
                : skill.promptTemplate;
            const isDirty = editPrompts[skill._id] !== undefined;

            return (
              <div
                key={skill._id}
                className="rounded-lg border border-zinc-700 bg-zinc-800"
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-sm font-medium text-amber-400">
                      /{skill.command}
                    </span>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {skill.description}
                    </p>
                  </div>

                  <div className="ml-3 flex items-center gap-3">
                    {/* On/Off toggle */}
                    <button
                      onClick={() => handleToggle(skill)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        skill.isEnabled ? "bg-amber-500" : "bg-zinc-600"
                      }`}
                      aria-label={skill.isEnabled ? "Disable skill" : "Enable skill"}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          skill.isEnabled ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="w-6 text-xs text-zinc-500">
                      {skill.isEnabled ? "On" : "Off"}
                    </span>

                    {/* Expand/collapse */}
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : skill._id)
                      }
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      {isExpanded ? "Hide" : "Details"}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-zinc-700 px-4 pb-4 pt-3 space-y-3">
                    {skill.sourceUrl && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500">
                          Source URL
                        </p>
                        <a
                          href={skill.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-xs text-amber-400 hover:underline"
                        >
                          {skill.sourceUrl}
                        </a>
                      </div>
                    )}

                    {skill.toolHints.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500">
                          Tool Hints
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {skill.toolHints.map((hint) => (
                            <span
                              key={hint}
                              className="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs text-zinc-300"
                            >
                              {hint}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">
                        Prompt Template
                      </p>
                      <textarea
                        value={promptValue}
                        onChange={(e) =>
                          setEditPrompts((prev) => ({
                            ...prev,
                            [skill._id]: e.target.value,
                          }))
                        }
                        rows={6}
                        className="w-full rounded border border-zinc-600 bg-zinc-900 p-2 font-mono text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleDelete(skill._id)}
                        disabled={deletingId === skill._id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === skill._id ? "Deleting…" : "Delete skill"}
                      </button>

                      {isDirty && (
                        <button
                          onClick={() => handleSavePrompt(skill)}
                          disabled={savingId === skill._id}
                          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400 disabled:opacity-50"
                        >
                          {savingId === skill._id ? "Saving…" : "Save"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

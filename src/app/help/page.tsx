"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { HelpSidebar } from "@/components/help/help-sidebar";
import {
  PersonaPicker,
  getStoredPersona,
  setStoredPersona,
  type PersonaId,
} from "@/components/help/persona-picker";
import { GettingStarted } from "@/components/help/getting-started";
import { PersonaGuides } from "@/components/help/persona-guides";
import { CommandsReference } from "@/components/help/commands-reference";
import { SourcesList } from "@/components/help/sources-list";
import { ApiKeysGuide } from "@/components/help/api-keys-guide";
import { PromptExamples } from "@/components/help/prompt-examples";
import { HelpFaq } from "@/components/help/faq";

export default function HelpPage() {
  const { userId: clerkId } = useAuth();
  const { user: clerkUser } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );
  const setHelpPersona = useMutation(api.users.setHelpPersona);

  const [persona, setPersona] = useState<PersonaId | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Load persona on mount
  useEffect(() => {
    if (convexUser?.helpPersona) {
      setPersona(convexUser.helpPersona as PersonaId);
    } else {
      const stored = getStoredPersona();
      if (stored) {
        setPersona(stored);
        // Sync localStorage to Convex if authenticated
        if (clerkId && convexUser && !convexUser.helpPersona) {
          setHelpPersona({ clerkId, helpPersona: stored });
        }
      } else {
        setShowPicker(true);
      }
    }
  }, [convexUser, clerkId, setHelpPersona]);

  // Scroll to hash on load
  useEffect(() => {
    if (persona && window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [persona]);

  function handleSelectPersona(selected: PersonaId) {
    setPersona(selected);
    setShowPicker(false);
    setStoredPersona(selected);
    if (clerkId) {
      setHelpPersona({ clerkId, helpPersona: selected });
    }
  }

  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress;

  // Show picker if no persona selected
  if (showPicker || !persona) {
    return (
      <main style={{ backgroundColor: "#0A1628", minHeight: "100vh" }}>
        <Nav />
        <PersonaPicker onSelect={handleSelectPersona} userEmail={userEmail} />
      </main>
    );
  }

  return (
    <main style={{ backgroundColor: "#0A1628", minHeight: "100vh" }}>
      <Nav />
      <div className="flex" style={{ minHeight: "calc(100vh - 64px)" }}>
        <HelpSidebar
          persona={persona}
          onChangePersona={() => setShowPicker(true)}
        />
        <div className="flex-1 overflow-y-auto px-10 py-10 max-md:px-5">
          <GettingStarted persona={persona} />
          <PersonaGuides persona={persona} />
          <CommandsReference />
          <SourcesList />
          <ApiKeysGuide clerkId={clerkId ?? undefined} />
          <PromptExamples persona={persona} />
          <HelpFaq />
        </div>
      </div>
      <Footer />
    </main>
  );
}

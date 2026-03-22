"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

declare global {
  interface Window {
    Canny?: (...args: unknown[]) => void;
  }
}

/**
 * Loads the Canny SDK and identifies the current user.
 * Renders nothing — just initializes Canny in the background.
 * Add this component once in the app layout.
 */
export function CannyInit() {
  const { userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Load Canny SDK
    if (!document.getElementById("canny-jssdk")) {
      const script = document.createElement("script");
      script.id = "canny-jssdk";
      script.type = "text/javascript";
      script.async = true;
      script.src = "https://sdk.canny.io/sdk.js";
      document.head.appendChild(script);
    }

    // Wait for SDK to load, then identify user
    if (!userId || !user || !window.Canny) {
      const checkInterval = setInterval(() => {
        if (window.Canny && userId && user) {
          clearInterval(checkInterval);
          identifyUser();
        }
      }, 500);
      // Cleanup after 10 seconds if it never loads
      const timeout = setTimeout(() => clearInterval(checkInterval), 10000);
      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }

    identifyUser();

    function identifyUser() {
      if (!window.Canny || !userId || !user) return;

      const appId = process.env.NEXT_PUBLIC_CANNY_APP_ID;
      if (!appId) return;

      window.Canny("identify", {
        appID: appId,
        user: {
          email: user.primaryEmailAddress?.emailAddress ?? "",
          name: user.fullName ?? user.firstName ?? "User",
          id: userId,
          avatarURL: user.imageUrl,
          created: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
        },
      });
    }
  }, [userId, user]);

  return null;
}

/**
 * Feedback button — links to your Canny feedback board.
 * Uses data-canny-link for automatic SSO authentication.
 */
export function FeedbackButton({ className }: { className?: string }) {
  const cannyUrl = process.env.NEXT_PUBLIC_CANNY_URL;
  if (!cannyUrl) return null;

  return (
    <a
      data-canny-link
      href={cannyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="Feedback"
      title="Send feedback"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    </a>
  );
}

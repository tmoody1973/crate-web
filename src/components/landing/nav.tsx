"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "FEATURES", href: "#features" },
  { label: "SOURCES", href: "#sources" },
  { label: "FOR DJS", href: "#showcase" },
  { label: "DOCS", href: "/docs" },
  { label: "CLI", href: "https://crate-cli.dev" },
] as const;

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{ backgroundColor: "#0A1628" }}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            style={{ height: "64px", width: "auto" }}
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-[family-name:var(--font-bebas)] text-[14px] tracking-[2px] transition-opacity hover:opacity-100"
              style={{ color: "#F5F0E8", opacity: 0.6 }}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/sign-in"
            className="font-[family-name:var(--font-bebas)] rounded px-5 py-2 text-[14px] tracking-[2px] transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
          >
            GET STARTED
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex items-center justify-center md:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          style={{ color: "#F5F0E8" }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="flex flex-col gap-4 px-6 pb-6 pt-2 md:hidden"
          style={{ backgroundColor: "#0A1628" }}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="font-[family-name:var(--font-bebas)] text-[16px] tracking-[2px] transition-opacity hover:opacity-100"
              style={{ color: "#F5F0E8", opacity: 0.7 }}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/sign-in"
            onClick={() => setMobileOpen(false)}
            className="font-[family-name:var(--font-bebas)] inline-block w-fit rounded px-5 py-2 text-[16px] tracking-[2px] transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
          >
            GET STARTED
          </Link>
        </div>
      )}
    </nav>
  );
}

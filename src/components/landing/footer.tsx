import Link from "next/link";

const navLinks = [
  { label: "CLI", href: "https://crate-cli.dev" },
  { label: "GITHUB", href: "https://github.com/tmoody1973/crate-web" },
  { label: "DOCS", href: "/docs" },
  { label: "PRIVACY", href: "/privacy" },
];

export function Footer() {
  return (
    <footer
      className="py-8 px-12 max-md:px-5 flex items-center justify-between max-md:flex-col max-md:gap-4 max-md:text-center"
      style={{
        backgroundColor: "#0A1628",
        borderTop: "1px solid rgba(245,240,232,0.06)",
      }}
    >
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/crate-logo_Light.svg"
        alt="Crate"
        style={{ height: "48px", width: "auto" }}
      />

      {/* Nav links */}
      <nav className="flex gap-6 max-md:gap-5 max-md:flex-wrap max-md:justify-center">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="font-[family-name:var(--font-bebas)] text-[12px] max-md:text-[14px] tracking-[2px] py-1 transition-colors"
            style={{ color: "rgba(245,240,232,0.40)" }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Copyright */}
      <p
        className="font-[family-name:var(--font-space)] text-[11px]"
        style={{ color: "rgba(245,240,232,0.20)" }}
      >
        &copy; 2024 Crate. Built in Milwaukee.
      </p>
    </footer>
  );
}

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/providers/convex-provider";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

const siteUrl = "https://crate-web.vercel.app";

export const metadata: Metadata = {
  title: "Crate — Dig Deeper",
  description:
    "AI-powered music research for DJs, producers, and crate diggers. 20+ sources. One agent. Zero tabs.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Crate — Dig Deeper",
    description:
      "AI-powered music research for DJs, producers, and crate diggers. 20+ sources. One agent. Zero tabs.",
    url: siteUrl,
    siteName: "Crate",
    images: [
      {
        url: "/crate_web_social.jpg",
        width: 1200,
        height: 625,
        alt: "Crate — AI-powered music research workspace",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crate — Dig Deeper",
    description:
      "AI-powered music research for DJs, producers, and crate diggers. 20+ sources. One agent. Zero tabs.",
    images: ["/crate_web_social.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import { ConvexClientProvider } from "@/providers/convex-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crate",
  description: "AI-powered music research workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}

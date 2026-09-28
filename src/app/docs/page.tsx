"use client";

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    window.location.href = "/help#commands";
  }, []);
  return null;
}

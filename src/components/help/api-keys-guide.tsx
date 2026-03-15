export function ApiKeysGuide({ clerkId }: { clerkId?: string }) {
  return (
    <section id="api-keys" className="mb-16">
      <h2 className="text-[28px] font-bold mb-4" style={{ color: "#F5F0E8" }}>
        API Keys Setup
      </h2>
      <p style={{ color: "#7a8a9a" }}>Coming soon.{clerkId ? "" : ""}</p>
    </section>
  );
}

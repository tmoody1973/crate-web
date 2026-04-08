export function DocsHero() {
  return (
    <section
      className="py-16 px-12 max-md:px-5 max-md:py-10"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <h1
        className="font-[family-name:var(--font-bebas)] text-[96px] max-lg:text-[72px] max-md:text-[56px] leading-[0.9] tracking-[-2px]"
        style={{ color: "#0A1628" }}
      >
        THE
        <br />
        <span style={{ color: "#E8520E" }}>MANUAL.</span>
      </h1>
      <p
        className="font-[family-name:var(--font-space)] text-[18px] max-md:text-[16px] mt-4 max-w-[500px]"
        style={{ color: "#3a4a5c" }}
      >
        Everything you need to master Crate — commands, prompts, use cases, and
        configuration.
      </p>
    </section>
  );
}

export function GuideHero() {
  return (
    <section
      className="py-20 px-12 max-md:px-5 max-md:py-14"
      style={{ backgroundColor: "#0A1628" }}
    >
      <h1
        className="font-[family-name:var(--font-bebas)] text-[96px] max-lg:text-[72px] max-md:text-[56px] leading-[0.9] tracking-[-2px]"
        style={{ color: "#F5F0E8" }}
      >
        THE TESTING
        <br />
        <span style={{ color: "#E8520E" }}>GUIDE.</span>
      </h1>
      <p
        className="font-[family-name:var(--font-space)] text-[18px] max-md:text-[16px] mt-4 max-w-[600px]"
        style={{ color: "rgba(245,240,232,0.6)" }}
      >
        Test prompts organized by user persona. Each section covers a real
        workflow with expected results.
      </p>

      <div className="mt-12 flex gap-8 max-md:flex-col max-md:gap-6">
        {[
          { step: "01", text: "Pick a persona that matches your style" },
          { step: "02", text: "Try the prompts in order within each category" },
          { step: "03", text: "Check the expected result after each response" },
        ].map((item) => (
          <div key={item.step} className="flex items-start gap-3">
            <span
              className="font-[family-name:var(--font-bebas)] text-[32px] leading-none"
              style={{ color: "#E8520E" }}
            >
              {item.step}
            </span>
            <p
              className="font-[family-name:var(--font-space)] text-[14px] max-w-[200px] mt-1"
              style={{ color: "rgba(245,240,232,0.5)" }}
            >
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

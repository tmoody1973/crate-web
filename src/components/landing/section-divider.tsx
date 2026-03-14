export function SectionDivider({
  number,
  label,
  dark = false,
}: {
  number: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-4 px-12 max-md:px-5 mb-10"
      style={{ color: dark ? "var(--cream)" : "var(--midnight)" }}
    >
      <span
        className="font-[family-name:var(--font-bebas)] text-5xl leading-none opacity-30"
        style={{ color: "var(--orange)" }}
      >
        {number}
      </span>
      <span className="flex-1 h-px bg-current opacity-15" />
      <span className="font-[family-name:var(--font-bebas)] text-[13px] tracking-[4px] opacity-40">
        {label}
      </span>
    </div>
  );
}

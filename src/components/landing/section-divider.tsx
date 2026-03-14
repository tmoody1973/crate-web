export function SectionDivider({
  number,
  label,
  dark = false,
}: {
  number: string;
  label: string;
  dark?: boolean;
}) {
  const textColor = dark ? "text-[var(--cream)]" : "text-[var(--midnight)]";
  return (
    <div className={`flex items-center gap-4 px-12 mb-10 ${textColor}`}>
      <span className="font-[family-name:var(--font-bebas)] text-5xl text-[var(--orange)] leading-none opacity-30">
        {number}
      </span>
      <span className="flex-1 h-px bg-current opacity-15" />
      <span className="font-[family-name:var(--font-bebas)] text-[13px] tracking-[4px] opacity-40">
        {label}
      </span>
    </div>
  );
}

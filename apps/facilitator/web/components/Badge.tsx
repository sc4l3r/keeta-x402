import { ComponentChildren } from "preact";

const badgeVariants = {
  warn: "bg-[#3a2a0744] text-warn border-warn",
  accent: "bg-[#ff886d18] text-accent border-accent",
  blue: "bg-[#6391ee18] text-blue border-blue",
  ok: "bg-ok-bg text-ok border-ok",
};

export function Badge({
  variant,
  children,
}: {
  variant: keyof typeof badgeVariants;
  children: ComponentChildren;
}) {
  return (
    <div
      class={`inline-flex items-center gap-1.25 text-xs font-bold rounded-sm px-2 py-0.5 mb-2 border ${badgeVariants[variant]}`}
    >
      {children}
    </div>
  );
}

import type { ComponentChildren } from "preact";

const btnBase =
  "inline-flex items-center gap-1.5 h-[34px] bg-raised border border-rim rounded-md px-[14px] text-ink-2 text-sm font-medium cursor-pointer whitespace-nowrap transition-[background,color,border-color] duration-150 hover:enabled:bg-hover hover:enabled:text-ink hover:enabled:border-rim-hi disabled:opacity-45 disabled:cursor-default";
const btnPrimary = `${btnBase} bg-accent border-accent text-[#1a0e0a] font-semibold hover:enabled:bg-accent-hi hover:enabled:border-accent-hi hover:enabled:text-[#1a0e0a]`;

export function Button({
  variant = "base",
  spinning,
  onClick,
  disabled,
  title,
  style,
  children,
}: {
  variant?: "primary" | "base";
  spinning?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  style?: Record<string, string | number>;
  children: ComponentChildren;
}) {
  return (
    <button
      class={variant === "primary" ? btnPrimary : btnBase}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {spinning && <span class="spinner" />}
      {children}
    </button>
  );
}

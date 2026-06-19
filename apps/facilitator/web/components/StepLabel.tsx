import type { ComponentChildren } from "preact";

export function StepLabel({
  num,
  children,
}: {
  num: number;
  children: ComponentChildren;
}) {
  return (
    <div class="text-xs font-semibold uppercase tracking-1 text-ink-dim mb-2 flex items-center gap-2">
      <span class="inline-flex items-center justify-center w-4.5 h-4.5 bg-c5 text-ink-2 rounded-full text-xs font-bold shrink-0">
        {num}
      </span>
      {children}
    </div>
  );
}

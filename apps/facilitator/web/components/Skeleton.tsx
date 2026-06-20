export function Sk({
  w,
  h,
  r,
  block,
  style,
}: {
  w: string | number;
  h: string | number;
  r?: string;
  block?: boolean;
  style?: Record<string, string>;
}) {
  return (
    <span
      class="skel"
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: r,
        display: block ? "block" : "inline-block",
        ...style,
      }}
    />
  );
}

const thCls =
  "px-4 py-2 text-xs font-medium text-ink-dim border-b border-edge text-left";

export function SkeletonStatCard() {
  return (
    <div class="bg-card border border-edge rounded-lg py-4 px-4.5">
      <div class="text-xs font-semibold uppercase tracking-[0.07em] text-ink-dim mb-2 flex items-center gap-1.5">
        <Sk w={6} h={6} r="50%" />
        <Sk w={64} h={10} />
      </div>
      <div class="mb-1">
        <Sk w={120} h={26} />
      </div>
      <Sk w={82} h={11} />
    </div>
  );
}

export function SkeletonNetPanel() {
  const tdCls = "py-[0.55rem] px-4 align-middle";
  return (
    <div class="bg-card border border-edge rounded-lg overflow-hidden">
      <div class="pt-3.5 px-4.5 pb-3 border-b border-edge bg-raised flex items-center justify-between gap-3">
        <div class="text-sm font-semibold text-ink flex items-center gap-1.75">
          <Sk w={6} h={6} r="50%" />
          <Sk w={72} h={14} />
        </div>
      </div>
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class={thCls}>Address</th>
            <th class={`${thCls} text-right`}>KTA</th>
            <th class={`${thCls} text-right`}>Block</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((i) => (
            <tr key={i} class={i < 2 ? "border-b border-edge" : ""}>
              <td class={tdCls}>
                <Sk w="82%" h={14} />
              </td>
              <td class={`${tdCls} text-right`}>
                <Sk w={54} h={14} />
              </td>
              <td class={`${tdCls} text-right`}>
                <Sk w={44} h={14} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StaleBadge() {
  return (
    <span class="text-xs font-semibold uppercase tracking-[0.06em] text-warn bg-[#3a2a0744] border border-warn rounded-sm px-1.5 py-px align-middle">
      stale
    </span>
  );
}

export function SkeletonCodeBlock({ lines = 4 }: { lines?: number }) {
  const widths = ["72%", "54%", "63%", "40%", "58%", "45%"];
  return (
    <div class="bg-c0 border border-edge rounded-md p-3.5 px-4 font-mono text-xs text-ink-2 overflow-auto max-h-80 whitespace-pre leading-[1.55] m-0 flex flex-col gap-1.75">
      {Array.from({ length: lines }, (_, i) => (
        <Sk key={i} w={widths[i % widths.length]!} h={11} block />
      ))}
    </div>
  );
}

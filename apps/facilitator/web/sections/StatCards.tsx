import { formatRawAmount, networkLabel } from "../lib/utils.js";
import { DEFAULT_SYMBOL } from "../lib/constants.js";
import { SkeletonStatCard, StaleBadge } from "../components/Skeleton.js";
import type { NetworkState } from "../lib/types.js";

export function StatCards({ states }: { states: NetworkState[] }) {
  if (states.length === 0) {
    return (
      <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-7 mt-7">
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
    );
  }

  return (
    <div class="flex flex-col sm:flex-row gap-3 mb-7 mt-7">
      {states.map((s) => {
        const { network, rows, stale } = s;
        const dec = network.decimals;
        const sym = network.symbol ?? DEFAULT_SYMBOL;
        const isMain = network.network === "main";

        const totalKta = rows.reduce(
          (acc, r) => (r.ktaRaw !== null && !r.error ? acc + r.ktaRaw : acc),
          0n,
        );
        const totalBlocks = rows.reduce<bigint | null>((acc, r) => {
          if (!r.blockHeight) return acc;
          try {
            const h = BigInt(r.blockHeight);
            return acc === null ? h : h + acc;
          } catch {
            return acc;
          }
        }, null);
        const anyErr = rows.some((r) => r.error || r.ktaRaw === null);

        return (
          <div
            class="bg-card border border-edge rounded-lg py-4 px-4.5 flex-1"
            key={network.network}
          >
            <div class="text-xs font-semibold uppercase tracking-[0.07em] text-ink-dim mb-2 flex items-center gap-1.5">
              <span
                class={`w-1.5 h-1.5 rounded-full shrink-0 ${isMain ? "bg-blue" : "bg-accent"}`}
              />
              {networkLabel(network.network)}
              {stale && <StaleBadge />}
            </div>
            {anyErr ? (
              <div class="text-bad text-xs">node unreachable</div>
            ) : dec !== null ? (
              <>
                <div class="text-xl font-semibold text-ink tracking-[-0.015em] leading-tight">
                  {formatRawAmount(totalKta, dec)} {sym}
                </div>
                <div class="text-xs text-ink-dim mt-1">
                  Total blocks{" "}
                  {totalBlocks !== null ? totalBlocks.toLocaleString() : "0"}
                </div>
              </>
            ) : (
              <div class="text-bad text-xs">metadata unavailable</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { KEETA_TESTNET_CAIP2 } from "@x402/keeta";
import {
  formatRawAmount,
  formatHeight,
  shortAddr,
  networkLabel,
} from "../lib/utils.js";
import { DEFAULT_SYMBOL } from "../lib/constants.js";
import { SkeletonNetPanel, StaleBadge } from "../components/Skeleton.js";
import type { NetworkState } from "../lib/types.js";

function explorerUrl(caip2: string, address: string): string {
  const base =
    caip2 === KEETA_TESTNET_CAIP2
      ? "https://explorer.test.keeta.com"
      : "https://explorer.keeta.com";
  return `${base}/account/${address}`;
}

const thCls = "px-4 py-2 text-xs font-medium text-ink-dim border-b border-edge";
const tdCls = "py-[0.55rem] px-4 align-middle";

export function NetworkColumns({ states }: { states: NetworkState[] }) {
  if (states.length === 0) {
    return (
      <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <SkeletonNetPanel />
        <SkeletonNetPanel />
      </div>
    );
  }

  return (
    <div class="flex flex-col lg:flex-row gap-4">
      {states.map((s) => {
        const { network, rows, stale } = s;
        const sym = network.symbol ?? DEFAULT_SYMBOL;
        const dec = network.decimals;
        const isMain = network.network === "main";

        return (
          <div
            class="bg-card border border-edge rounded-lg overflow-hidden flex-1"
            key={network.network}
          >
            <div class="pt-3.5 px-4.5 pb-3 border-b border-edge bg-raised flex items-center justify-between gap-3">
              <div class="text-sm font-semibold text-ink flex items-center gap-1.75">
                <span
                  class={`w-1.5 h-1.5 rounded-full shrink-0 ${isMain ? "bg-blue" : "bg-accent"}`}
                />
                {networkLabel(network.network)}
                {stale && <StaleBadge />}
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-sm min-w-100">
                <thead>
                  <tr>
                    <th class={`${thCls} text-left`}>Address</th>
                    <th class={`${thCls} text-right`}>{sym}</th>
                    <th class={`${thCls} text-right`}>Blocks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const ok = !row.error && row.ktaRaw !== null;
                    return (
                      <tr
                        key={row.address}
                        class={`hover:bg-hover${i < rows.length - 1 ? " border-b border-edge" : ""}`}
                      >
                        <td
                          class={`${tdCls} font-mono text-xs text-ink-2 break-all`}
                          title={row.address}
                        >
                          <a
                            href={explorerUrl(network.caip2, row.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-inherit no-underline hover:text-ink hover:underline"
                          >
                            {shortAddr(row.address)}
                          </a>
                        </td>
                        <td class={`${tdCls} text-right text-ink tabular-nums`}>
                          {ok && dec !== null ? (
                            formatRawAmount(row.ktaRaw!, dec)
                          ) : (
                            <span class="text-bad text-xs">-</span>
                          )}
                        </td>
                        <td
                          class={`${tdCls} text-right text-ink-3 tabular-nums`}
                        >
                          {formatHeight(row.blockHeight)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

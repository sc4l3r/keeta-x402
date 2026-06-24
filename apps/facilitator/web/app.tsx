import { useState, useEffect } from "preact/hooks";
import { loadNetworkStates } from "./lib/data.js";
import { StatCards } from "./sections/StatCards.js";
import { NetworkColumns } from "./sections/NetworkColumns.js";
import { DemoSection } from "./sections/DemoSection.js";
import { TsBlock } from "./components/Highlight.js";
import type {
  AccountsResponse,
  NetworkState,
  Thresholds,
} from "./lib/types.js";

const REFRESH_MS = 30_000;

const linkCls =
  "text-xs text-ink-3 no-underline bg-raised border border-rim rounded-full px-3 py-[3px] transition-[color,border-color] duration-150 hover:text-ink hover:border-rim-hi";

export function App() {
  const [states, setStates] = useState<NetworkState[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [statusMsg, setStatusMsg] = useState("Loading...");
  const [statusErr, setStatusErr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(data: AccountsResponse) {
    setRefreshing(true);
    await loadNetworkStates(data.networks, data.accounts, setStates);
    setStatusMsg(`Refreshed at ${new Date().toLocaleTimeString()}`);
    setStatusErr(false);
    setRefreshing(false);
  }

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;

    async function init() {
      setRefreshing(true);
      let data: AccountsResponse;
      try {
        const r = await fetch("/accounts");
        if (!r.ok) throw new Error(`/accounts → ${r.status}`);
        data = (await r.json()) as AccountsResponse;
      } catch {
        setStatusMsg("Cannot reach /accounts endpoint");
        setStatusErr(true);
        setRefreshing(false);
        return;
      }
      setThresholds(data.thresholds ?? null);
      await refresh(data);
      id = setInterval(() => refresh(data), REFRESH_MS);
    }

    init();
    return () => clearInterval(id);
  }, []);

  const demoNetwork = states.find((s) => s.network.demoEnabled)?.network;

  const integrationSnippet = [
    `import { HTTPFacilitatorClient } from "@x402/core/server";`,
    ``,
    `const facilitatorClient = new HTTPFacilitatorClient({`,
    `  url: "${window.location.origin}",`,
    `});`,
  ].join("\n");

  return (
    <>
      <header class="pt-10 pb-7 border-b border-edge">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
          <h1 class="text-2xl font-bold mb-1.5 text-ink tracking-[-0.01em]">
            x402 Facilitator for Keeta
          </h1>
          <div
            class={`text-sm flex items-center gap-1.5 sm:my-auto ${statusErr ? "text-bad" : "text-ink-3"}`}
          >
            {refreshing && <span class="spinner" />}
            {statusMsg}
          </div>
        </div>
        <p class="mt-1 text-ink-2 leading-[1.65]">
          This host implements the facilitator part of the{" "}
          <a
            href="https://github.com/x402-foundation/x402"
            target="_blank"
            class="text-accent no-underline hover:underline"
          >
            x402 payment protocol
          </a>{" "}
          for Keeta and is used by resource servers to verify and settle
          payments. Network fees are sponsored so clients can perform payments
          for free.
        </p>
        <div class="flex flex-wrap gap-2 mt-5">
          <a
            href="https://www.npmjs.com/package/@x402/keeta"
            target="_blank"
            class={linkCls}
          >
            @x402/keeta
          </a>
          <a
            href="https://raw.githubusercontent.com/sc4l3r/keeta-x402/main/docs/agent-guide.md"
            target="_blank"
            class={linkCls}
          >
            Agent Guide
          </a>
          <a href="/llms.txt" target="_blank" class={linkCls}>
            llms.txt
          </a>
          <a
            href="https://github.com/sc4l3r/keeta-x402"
            target="_blank"
            class={linkCls}
          >
            GitHub
          </a>
          <a
            href="https://github.com/sc4l3r/keeta-x402/blob/main/apps/client/src/main.ts"
            target="_blank"
            class={linkCls}
          >
            Example Client
          </a>
          <a
            href="https://github.com/sc4l3r/keeta-x402/blob/main/apps/server/src/main.ts"
            target="_blank"
            class={linkCls}
          >
            Example Server
          </a>
        </div>
      </header>

      <div class="border-b border-edge pb-7">
        <StatCards states={states} />

        <div class="flex items-center justify-between gap-4">
          <span class="text-xs font-semibold uppercase tracking-[0.06em] text-ink-dim">
            Fee-payer accounts
          </span>
        </div>

        <p class="my-2 text-ink-2 text-sm leading-[1.65]">
          This facilitator uses the following pool of Keeta accounts to settle
          transactions and pay network fees.
        </p>
        <NetworkColumns states={states} thresholds={thresholds} />
      </div>

      <div class="mt-5">
        <div class="text-xs font-semibold uppercase tracking-[0.06em] text-ink-dim mb-4">
          For Sellers
        </div>
        <div class="bg-card border border-edge rounded-lg p-6">
          <p class="mb-2 text-ink-2 text-sm leading-[1.65]">
            To integrate this facilitator into your resource server follow the{" "}
            <a
              href="https://docs.x402.org/getting-started/quickstart-for-sellers"
              target="_blank"
              class="text-accent no-underline hover:underline"
            >
              official x402 getting started guide
            </a>{" "}
            and configure the facilitator client like this:
          </p>
          <TsBlock code={integrationSnippet} style={{ maxHeight: "none" }} />
        </div>
      </div>

      {demoNetwork && (
        <DemoSection
          symbol={demoNetwork.symbol}
          decimals={demoNetwork.decimals}
        />
      )}

      <footer class="mt-4 text-ink-dim flex flex-col justify-around gap-2 px-4 md:flex-row md:justify-between">
        <div class="w-fit mx-auto md:mx-0">
          Found a bug? Report an{" "}
          <a
            href="https://github.com/sc4l3r/keeta-x402/issues"
            target="_blank"
            class="text-accent no-underline hover:underline"
          >
            issue
          </a>{" "}
          or a{" "}
          <a
            href="https://github.com/sc4l3r/keeta-x402/security"
            class="text-accent no-underline hover:underline"
          >
            vulnerability
          </a>
        </div>
        <div class="w-fit mx-auto md:mx-0">
          Built in collaboration with{" "}
          <a
            href="https://keeta.com"
            target="_blank"
            class="text-accent no-underline hover:underline"
          >
            Keeta
          </a>{" "}
          by{" "}
          <a
            href="https://github.com/sc4l3r"
            target="_blank"
            class="text-accent no-underline hover:underline"
          >
            Scaler
          </a>
        </div>
      </footer>
    </>
  );
}

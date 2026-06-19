import { useRef } from "preact/hooks";
import { formatRawAmount } from "../lib/utils.js";
import { DEFAULT_DECIMALS, DEFAULT_SYMBOL } from "../lib/constants.js";
import { useScrollIntoViewWhen } from "../hooks/useScrollIntoViewWhen.js";
import { Sk, SkeletonCodeBlock } from "../components/Skeleton.js";
import { Button } from "../components/Button.js";
import { JsonBlock } from "../components/Highlight.js";
import { Badge } from "../components/Badge.js";
import { StepLabel } from "../components/StepLabel.js";
import { useX402Demo } from "../hooks/useX402Demo.js";

export function DemoSection({
  symbol,
  decimals,
}: {
  symbol?: string | null;
  decimals?: number | null;
}) {
  const sym = symbol ?? DEFAULT_SYMBOL;
  const dec = decimals ?? DEFAULT_DECIMALS;
  const demo = useX402Demo();
  const {
    phase,
    address,
    balance,
    message,
    isError,
    paymentRequired,
    paymentPayload,
    paymentBlock,
    settlementResponse,
    weatherResult,
    busy,
    hasAddress,
    needsFunding,
  } = demo;

  const step2Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);
  const paymentPayloadRef = useRef<HTMLDivElement>(null);
  const weatherResultRef = useRef<HTMLDivElement>(null);

  useScrollIntoViewWhen(address, step2Ref);
  useScrollIntoViewWhen(paymentRequired, step4Ref);
  useScrollIntoViewWhen(paymentPayload, paymentPayloadRef);
  useScrollIntoViewWhen(weatherResult, weatherResultRef);

  // Step 4 stays mounted once a 402 is in view and through settlement.
  const showPaymentStep =
    phase === "showing-402" || phase === "paying" || phase === "paid";
  const isPaid = phase === "paid";

  return (
    <div class="mt-5 border-t border-edge pt-5">
      <div class="flex items-center justify-between mb-4 gap-4">
        <span class="text-xs font-semibold uppercase tracking-[0.06em] text-ink-dim">
          Interactive demo
        </span>
      </div>
      <div class="bg-card border border-edge rounded-lg p-6 flex flex-col gap-6">
        <p class="text-sm text-ink-2 leading-[1.7]">
          This facilitator hosts a demo{" "}
          <code class="font-mono text-ink-2">/weather</code> route that requires
          a payment of either 0.001 KTA or 0.001 USDC per request on testnet.
          Follow the steps below to perform your first x402 payment on Keeta.
        </p>

        {/* Step 1: Passphrase */}
        <div>
          <StepLabel num={1}>Passphrase or seed</StepLabel>
          <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
            Performing a payment via x402 requires a Keeta account. Simply
            generate a new testnet account below or enter the passphrase of an
            existing account you want to use for the payment. All operations
            will be performed on testnet and the seed never leaves this browser
            tab.
          </p>
          <div class="flex flex-col gap-2">
            <input
              class="w-full h-8.5 bg-c0 border border-rim rounded-md px-2.75 text-ink font-mono text-xs outline-none transition-[border-color] duration-150 focus:border-blue"
              type="text"
              aria-label="Passphrase or seed"
              placeholder="any passphrase, or click generate"
              value={demo.passphrase}
              onInput={(e) =>
                demo.setPassphrase((e.target as HTMLInputElement).value)
              }
            />
            <div class="flex gap-2.5 flex-wrap">
              <Button onClick={demo.generateSeed} disabled={busy}>
                Generate random
              </Button>
              <Button
                variant="primary"
                onClick={demo.deriveAccount}
                disabled={busy || !demo.passphrase.trim()}
                spinning={phase === "deriving"}
              >
                Derive account
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Account info */}
        {hasAddress && (
          <div ref={step2Ref}>
            <StepLabel num={2}>Testnet account</StepLabel>
            <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
              This is the account we will use for the payment:
            </p>
            <div class="py-3 px-4 bg-raised border border-edge rounded-md mb-2 flex flex-col gap-1">
              <span class="text-xs text-ink-dim">Address</span>
              <span class="font-mono text-xs text-ink-2 break-all">
                {address}
              </span>
            </div>
            <div class="flex flex-col gap-2">
              <div class="py-3 px-4 bg-raised border border-edge rounded-md flex flex-col gap-1">
                <span class="text-xs text-ink-dim">Balance</span>
                {phase === "checking-balance" || phase === "deriving" ? (
                  <Sk w={96} h={16} />
                ) : balance !== null ? (
                  <span
                    class={`text-sm font-semibold tabular-nums ${needsFunding ? "text-warn" : "text-ink"}`}
                  >
                    {formatRawAmount(balance, dec)} {sym}
                    {needsFunding ? ", needs funding" : ""}
                  </span>
                ) : (
                  <span class="text-sm font-semibold text-warn tabular-nums">
                    unknown
                  </span>
                )}
              </div>
              <div class="flex gap-2.5 flex-wrap">
                <Button onClick={demo.refreshBalance} disabled={busy}>
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  onClick={demo.requestFaucet}
                  disabled={busy || !needsFunding}
                  title={!needsFunding ? "Balance already sufficient" : ""}
                  spinning={phase === "funding"}
                >
                  Request faucet
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Plain fetch */}
        {hasAddress && balance !== null && !needsFunding && (
          <div>
            <StepLabel num={3}>Fetch /weather without payment</StepLabel>
            <div class="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="primary"
                onClick={demo.fetchPlain}
                disabled={busy}
                spinning={phase === "fetch-plain"}
              >
                GET /weather
              </Button>
            </div>
            {phase === "fetch-plain" && (
              <div class="mt-3.5">
                <Sk w={160} h={22} block style={{ marginBottom: "0.5rem" }} />
                <SkeletonCodeBlock lines={5} />
              </div>
            )}
            {showPaymentStep && paymentRequired !== null && (
              <div class="mt-3.5">
                <Badge variant="warn">402 Payment Required</Badge>
                <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
                  The server requires a payment for the route and sends the
                  requirements in the <code>PAYMENT-REQUIRED</code> header of
                  the 402 response. In this case, it accepts both KTA and USDC
                  on testnet and defines the address to receive the payment in
                  the <code class="font-mono text-ink-2">payTo</code> field.
                </p>
                <JsonBlock value={paymentRequired} />
              </div>
            )}
          </div>
        )}

        {/* Step 4: Pay */}
        {showPaymentStep && (
          <div ref={step4Ref}>
            <StepLabel num={4}>Sign payment block &amp; pay</StepLabel>
            <div class="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="primary"
                onClick={demo.payAndFetch}
                disabled={busy || isPaid}
                spinning={phase === "paying"}
              >
                Pay with x402
              </Button>
            </div>

            {(phase === "paying" || isPaid) && paymentPayload === null && (
              <div class="mt-3.5">
                <Sk w={160} h={18} block style={{ marginBottom: "0.5rem" }} />
                <SkeletonCodeBlock lines={3} />
              </div>
            )}
            {paymentPayload !== null && (
              <div ref={paymentPayloadRef} class="mt-3.5">
                <Badge variant="accent">Payment payload</Badge>
                <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
                  Based on the payment requirements sent by the resource server
                  the client constructs a payment payload including a signed but
                  unsubmitted block that fullfills the payment requirements.
                </p>
                <JsonBlock
                  value={paymentPayload}
                  style={{ fontSize: "0.72rem" }}
                />
              </div>
            )}
            {paymentBlock !== null && (
              <div class="mt-3.5">
                <Badge variant="accent">Decoded payment block</Badge>
                <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
                  The payment block typically only contains a single SEND
                  instruction which sends any of the accepted assets in the
                  right amount to the server's address.
                </p>
                <JsonBlock
                  value={paymentBlock}
                  style={{ fontSize: "0.72rem" }}
                />
              </div>
            )}

            {phase === "paying" &&
              paymentPayload !== null &&
              settlementResponse === null && (
                <div class="mt-3.5">
                  <Sk w={120} h={18} block style={{ marginBottom: "0.5rem" }} />
                  <SkeletonCodeBlock lines={3} />
                </div>
              )}
            {settlementResponse !== null && (
              <div class="mt-3.5">
                <Badge variant="blue">Settlement response</Badge>
                <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
                  When the payment succeeds, the server returns the payment
                  result in the <code>PAYMENT-RESPONSE</code> header.
                </p>
                <JsonBlock
                  value={settlementResponse}
                  style={{ fontSize: "0.72rem" }}
                />
              </div>
            )}

            {isPaid && weatherResult !== null && (
              <div ref={weatherResultRef} class="mt-3.5">
                <Badge variant="ok">200 OK on /weather response</Badge>
                <p class="text-sm text-ink-2 mb-3 leading-[1.7]">
                  After a successful payment, the server also returns the
                  resource the client requested originally, in this case the
                  weather report.
                </p>
                <JsonBlock value={weatherResult} />
                <Button
                  variant="primary"
                  onClick={demo.reset}
                  style={{ marginTop: "0.75rem" }}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Status / errors */}
        {message && (
          <div
            class={`text-sm flex items-center gap-1.5 ${isError ? "text-bad" : phase === "ready" ? "text-ok" : "text-ink-3"}`}
          >
            {busy && <span class="spinner" />}
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

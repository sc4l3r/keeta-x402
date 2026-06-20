import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import {
  ExactKeetaScheme,
  KEETA_TESTNET_CAIP2,
  toClientKeetaSigner,
  type ClientKeetaSigner,
} from "@x402/keeta";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type {
  PaymentPayload,
  PaymentRequired,
  SettleResponse,
} from "@x402/core/types";
import { getTestnetBalance } from "../lib/data.js";

export type DemoPhase =
  | "idle"
  | "deriving"
  | "ready"
  | "checking-balance"
  | "funding"
  | "fetch-plain"
  | "showing-402"
  | "paying"
  | "paid";

/** Phases during which an operation is in flight. */
const BUSY_PHASES: ReadonlySet<DemoPhase> = new Set([
  "deriving",
  "checking-balance",
  "funding",
  "fetch-plain",
  "paying",
]);

const MIN_BALANCE = 1_000_000n; // 0.001 KTA

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useX402Demo() {
  const [passphrase, setPassphraseState] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [paymentRequired, setPaymentRequired] =
    useState<PaymentRequired | null>(null);
  const [paymentPayload, setPaymentPayload] = useState<PaymentPayload | null>(
    null,
  );
  const [paymentBlock, setPaymentBlock] = useState<unknown>(null);
  const [settlementResponse, setSettlementResponse] = useState<
    SettleResponse | PaymentRequired | null
  >(null);
  const [weatherResult, setWeatherResult] = useState<unknown>(null);

  const accountRef = useRef<InstanceType<typeof KeetaNet.lib.Account> | null>(
    null,
  );
  const signerRef = useRef<ClientKeetaSigner | null>(null);

  // Unmount + reset guard: every cancelable operation captures the current
  // generation and only commits state while it is still the live one. `reset`
  // and unmount bump the generation so stale async work is dropped.
  const mountedRef = useRef(true);
  const genRef = useRef(0);
  const alive = (gen: number) => mountedRef.current && gen === genRef.current;

  // A scheme-less client is enough to parse 402 responses
  const parseClient = useMemo(() => new x402HTTPClient(new x402Client()), []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      void signerRef.current?.destroy();
    },
    [],
  );

  const busy = BUSY_PHASES.has(phase);
  const hasAddress = address !== null;
  const needsFunding = balance !== null && balance < MIN_BALANCE;

  function status(m: string | null, err = false) {
    setMessage(m);
    setIsError(err);
  }

  function clearPaymentState() {
    setPaymentRequired(null);
    setPaymentPayload(null);
    setPaymentBlock(null);
    setSettlementResponse(null);
    setWeatherResult(null);
  }

  function reset() {
    genRef.current++;
    void signerRef.current?.destroy();
    signerRef.current = null;
    accountRef.current = null;
    setAddress(null);
    setBalance(null);
    setPhase("idle");
    clearPaymentState();
    status(null);
  }

  function setPassphrase(value: string) {
    setPassphraseState(value);
    if (hasAddress || phase !== "idle") reset();
  }

  function generateSeed() {
    setPassphraseState(
      KeetaNet.lib.Account.generateRandomSeed({ asString: true }),
    );
    reset();
  }

  async function loadBalance(addr: string, silent: boolean, gen: number) {
    if (!silent) setPhase("checking-balance");
    try {
      const bal = await getTestnetBalance(addr);
      if (!alive(gen)) return;
      setBalance(bal);
      if (!silent) {
        setPhase("ready");
        status(null);
      }
    } catch (err) {
      if (!alive(gen) || silent) return;
      status(`Balance check failed: ${errMessage(err)}`, true);
      setPhase("ready");
    }
  }

  function refreshBalance() {
    if (address) void loadBalance(address, false, genRef.current);
  }

  async function deriveAccount() {
    const pass = passphrase.trim();
    if (!pass) return;
    const gen = ++genRef.current;

    void signerRef.current?.destroy();
    signerRef.current = null;

    setPhase("deriving");

    try {
      const seed = await KeetaNet.lib.Account.seedFromPassphrase(pass);
      if (!alive(gen)) return;

      const account = KeetaNet.lib.Account.fromSeed(seed, 0);
      accountRef.current = account;
      signerRef.current = toClientKeetaSigner(account);

      const addr = account.publicKeyString.toString();
      setAddress(addr);
      setPhase("checking-balance");

      await loadBalance(addr, false, gen);
    } catch (err) {
      if (!alive(gen)) return;
      status(`Failed: ${errMessage(err)}`, true);
      setPhase("idle");
    }
  }

  async function requestFaucet() {
    if (!address) return;
    const gen = genRef.current;
    setPhase("funding");
    try {
      const resp = await fetch("/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!alive(gen)) return;
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${resp.status}`,
        );
      }
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1_200));
        if (!alive(gen)) return;
        try {
          const bal = await getTestnetBalance(address);
          if (!alive(gen)) return;
          setBalance(bal);
          if (bal >= MIN_BALANCE) {
            setPhase("ready");
            return;
          }
        } catch {
          // transient errors during polling are fine
        }
      }
      setPhase("ready");
    } catch (err) {
      if (!alive(gen)) return;
      status(`Faucet error: ${errMessage(err)}`, true);
      setPhase("ready");
    }
  }

  function parsePaymentRequired(
    client: x402HTTPClient,
    resp: Response,
    body: unknown,
  ) {
    return client.getPaymentRequiredResponse(
      (name) => resp.headers.get(name),
      body,
    );
  }

  async function fetchPlain() {
    const gen = genRef.current;
    setPhase("fetch-plain");
    clearPaymentState();
    try {
      const resp = await fetch("/weather");
      if (!alive(gen)) return;
      if (resp.status === 402) {
        const body = await resp.json().catch(() => undefined);
        if (!alive(gen)) return;
        setPaymentRequired(parsePaymentRequired(parseClient, resp, body));
        setPhase("showing-402");
        status(null);
      } else {
        const result = await resp.json();
        if (!alive(gen)) return;
        setWeatherResult(result);
        setPhase("paid");
        status(null);
      }
    } catch (err) {
      if (!alive(gen)) return;
      status(`Fetch error: ${errMessage(err)}`, true);
      setPhase("ready");
    }
  }

  async function payAndFetch() {
    if (!accountRef.current || !signerRef.current) return;
    const signer = signerRef.current;
    const gen = genRef.current;
    setPhase("paying");
    try {
      const x402 = new x402Client();
      x402.register(KEETA_TESTNET_CAIP2, new ExactKeetaScheme(signer));
      const httpClient = new x402HTTPClient(x402);

      const resp = await fetch("/weather");
      if (!alive(gen)) return;
      if (resp.status !== 402) {
        const result = await resp.json();
        if (!alive(gen)) return;
        setWeatherResult(result);
        setPhase("paid");
        status(null);
        if (address) await loadBalance(address, true, gen);
        return;
      }

      const body = await resp.json().catch(() => undefined);
      if (!alive(gen)) return;
      const payReq = parsePaymentRequired(httpClient, resp, body);
      const payload = await httpClient.createPaymentPayload(payReq);
      if (!alive(gen)) return;
      setPaymentPayload(payload);
      try {
        setPaymentBlock(
          new KeetaNet.lib.Block(payload.payload.block as string).toJSON(),
        );
      } catch {
        /* non-fatal: decoded block is illustrative only */
      }

      const result = await httpClient.processResponse(
        await fetch("/weather", {
          headers: httpClient.encodePaymentSignatureHeader(payload),
        }),
      );
      if (!alive(gen)) return;
      setWeatherResult(result.body);
      setSettlementResponse(result.header ?? null);
      setPhase("paid");
      status(null);
      if (address) await loadBalance(address, true, gen);
    } catch (err) {
      if (!alive(gen)) return;
      status(`Payment error: ${errMessage(err)}`, true);
      setPhase("showing-402");
    }
  }

  return {
    // state
    passphrase,
    address,
    balance,
    phase,
    message,
    isError,
    paymentRequired,
    paymentPayload,
    paymentBlock,
    settlementResponse,
    weatherResult,
    // derived
    busy,
    hasAddress,
    needsFunding,
    // actions
    setPassphrase,
    generateSeed,
    deriveAccount,
    refreshBalance,
    requestFaucet,
    fetchPlain,
    payAndFetch,
    reset,
  };
}

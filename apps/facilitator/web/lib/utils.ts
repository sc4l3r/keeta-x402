export function formatRawAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

export function formatHeight(h: string | null): string {
  if (!h) return "0";
  try {
    return BigInt(h).toLocaleString();
  } catch {
    return h;
  }
}

export function shortAddr(addr: string): string {
  return addr.slice(0, 14) + "..." + addr.slice(-6);
}

export function networkLabel(network: string): string {
  if (network === "test") return "Testnet";
  if (network === "main") return "Mainnet";
  return network;
}

export function ktaToRaw(kta: string, decimals: number): bigint | null {
  const [intPart = "", fracPart = ""] = kta.split(".");
  if (fracPart.length > decimals) return null;
  try {
    const paddedFrac = fracPart.padEnd(decimals, "0");
    return (
      BigInt(intPart || "0") * 10n ** BigInt(decimals) +
      BigInt(paddedFrac || "0")
    );
  } catch {
    return null;
  }
}

export function classifyHealth(
  ktaRaw: bigint | null,
  decimals: number | null,
  thresholds: { minBalanceKta: string; refillThresholdKta: string } | null,
): "healthy" | "degraded" | "disabled" | null {
  if (ktaRaw === null || decimals === null || !thresholds) return null;

  const min = ktaToRaw(thresholds.minBalanceKta, decimals);
  const refill = ktaToRaw(thresholds.refillThresholdKta, decimals);

  if (min === null || refill === null) return null;

  if (ktaRaw >= refill) return "healthy";
  if (ktaRaw >= min) return "degraded";
  return "disabled";
}

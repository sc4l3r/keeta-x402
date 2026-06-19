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

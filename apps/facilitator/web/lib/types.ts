export type NetworkInfo = {
  network: string;
  caip2: string;
  demoEnabled: boolean;
  symbol: string | null;
  decimals: number | null;
};

export type Thresholds = {
  minBalanceKta: string;
  refillThresholdKta: string;
};

export type AccountHealth = "healthy" | "degraded" | "disabled";

export type AccountsResponse = {
  networks: NetworkInfo[];
  accounts: string[];
  thresholds: Thresholds;
};

export type RowData = {
  address: string;
  ktaRaw: bigint | null;
  blockHeight: string | null;
  error?: string;
};

export type NetworkState = {
  network: NetworkInfo;
  rows: RowData[];
  stale: boolean;
};

export type NetworkInfo = {
  network: string;
  caip2: string;
  demoEnabled: boolean;
  symbol: string | null;
  decimals: number | null;
};

export type AccountsResponse = {
  networks: NetworkInfo[];
  accounts: string[];
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

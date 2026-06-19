import * as KeetaNet from "@keetanetwork/keetanet-client";
import { Networks } from "@keetanetwork/keetanet-client/config";
import type { NetworkInfo, NetworkState, RowData } from "./types.js";

const userClients = new Map<string, KeetaNet.UserClient>();

export function getClient(networkId: string): KeetaNet.UserClient {
  const existing = userClients.get(networkId);
  if (existing) return existing;
  const client = KeetaNet.UserClient.fromNetwork(networkId as Networks, null);
  userClients.set(networkId, client);
  return client;
}

export async function fetchNetworkRows(
  network: NetworkInfo,
  addresses: string[],
): Promise<RowData[]> {
  const client = getClient(network.network);
  const info = await client.client.getAccountsInfo(addresses);
  const baseTokenKey = client.baseToken.publicKeyString.toString();
  return addresses.map((address) => {
    const entry = info[address];
    if (!entry) {
      return { address, ktaRaw: null, blockHeight: null, error: "no data" };
    }
    const balEntry = entry.balances.find(
      (b) => b.token.publicKeyString.toString() === baseTokenKey,
    );
    return {
      address,
      ktaRaw: balEntry?.balance ?? 0n,
      blockHeight: entry.currentHeadBlockHeight,
    };
  });
}

export async function loadNetworkStates(
  networks: NetworkInfo[],
  accounts: string[],
  setStates: (fn: (prev: NetworkState[]) => NetworkState[]) => void,
): Promise<void> {
  const results = await Promise.all(
    networks.map(async (network) => {
      try {
        const rows = await fetchNetworkRows(network, accounts);
        return { network, rows, stale: false };
      } catch {
        setStates((prev) => {
          const existing = prev.find(
            (s) => s.network.network === network.network,
          );
          if (existing) {
            return prev.map((s) =>
              s.network.network === network.network ? { ...s, stale: true } : s,
            );
          }
          const fallback = accounts.map((address) => ({
            address,
            ktaRaw: null as bigint | null,
            blockHeight: null as string | null,
            error: "unreachable",
          }));
          return [...prev, { network, rows: fallback, stale: true }];
        });
        return null;
      }
    }),
  );

  const valid = results.filter((s): s is NetworkState => s !== null);
  if (valid.length > 0) {
    setStates((prev) => {
      const merged = [...prev];
      for (const s of valid) {
        const idx = merged.findIndex(
          (m) => m.network.network === s.network.network,
        );
        if (idx >= 0) merged[idx] = s;
        else merged.push(s);
      }
      return merged;
    });
  }
}

export async function getTestnetBalance(address: string): Promise<bigint> {
  const client = getClient("test");
  return client.client.getBalance(address, client.baseToken);
}

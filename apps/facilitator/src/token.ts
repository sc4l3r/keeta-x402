import { decodeTokenMetadata } from "@keetanetwork/anchor/lib/token-metadata.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { Networks } from "@keetanetwork/keetanet-client/config/index.js";
import type { NetworkIDs } from "./config.js";

export type TokenInfo = {
  symbol: string;
  decimals: number;
};

// Per-network cache populated lazily on the first /accounts request.
const cache = new Map<Networks, TokenInfo>();

// Per-network in-flight promise so concurrent callers share one fetch.
const inflight = new Map<Networks, Promise<TokenInfo>>();

async function fetchBaseToken(network: NetworkIDs): Promise<TokenInfo> {
  await using client = KeetaNet.UserClient.fromNetwork(network.network, null);

  const baseToken = client.baseToken;
  const info = await client.client.getAccountInfo(
    baseToken.publicKeyString.toString(),
  );
  const metadata = decodeTokenMetadata(info.info.metadata);
  return {
    symbol: info.info.name,
    decimals: metadata.decimalPlaces,
  };
}

export async function getBaseTokenInfo(
  network: NetworkIDs,
): Promise<TokenInfo> {
  const cached = cache.get(network.network);
  if (cached) return cached;

  const existing = inflight.get(network.network);
  if (existing) return existing;

  const promise = fetchBaseToken(network)
    .then((info) => {
      cache.set(network.network, info);
      inflight.delete(network.network);
      return info;
    })
    .catch((err) => {
      inflight.delete(network.network);
      throw err;
    });

  inflight.set(network.network, promise);
  return promise;
}

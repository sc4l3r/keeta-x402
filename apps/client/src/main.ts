// Inspired by https://github.com/coinbase/x402/tree/main/examples/typescript/clients/fetch

import * as dotenv from "dotenv";

import * as KeetaNet from "@keetanetwork/keetanet-client";
import { x402HTTPClient } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactKeetaScheme, KEETA_TESTNET_CAIP2, toClientKeetaSigner } from "@x402/keeta";

dotenv.config({
  path: '../../.env'
});

async function main() {
  if (!process.env.CLIENT_PASSPHRASE) {
    console.error("CLIENT_PASSPHRASE environment variable is not set");
    return;
  }

  const account = KeetaNet.lib.Account.fromSeed(
    await KeetaNet.lib.Account.seedFromPassphrase(process.env.CLIENT_PASSPHRASE),
    0
  );

  await using clientKeetaSigner = toClientKeetaSigner(account);

  const client = new x402Client();
  client.register(KEETA_TESTNET_CAIP2, new ExactKeetaScheme(clientKeetaSigner));

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const httpClient = new x402HTTPClient(client);

  const response = await fetchWithPayment("http://localhost:4021/weather", {
    method: "GET",
  });

  const result = await httpClient.processResponse(response);
  console.log("Response:", result.body);

  // Get payment receipt from response headers
  if (result.paymentStatus === "settled") {
    console.log("Payment settled:", result.header);
  } else if (result.paymentStatus === "settle_failed") {
    console.error("Settlement failed:", result.header);
  }
}

main()
  .catch((error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  });

// Inspired by https://github.com/coinbase/x402/tree/main/examples/typescript/clients/fetch

import * as dotenv from "dotenv";

import * as KeetaNet from "@keetanetwork/keetanet-client";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactKeetaScheme, toClientKeetaSigner } from "@x402/keeta";

dotenv.config();

async function main() {
  if (!process.env.CLIENT_PASSPHRASE) {
    console.error("CLIENT_PASSPHRASE environment variable is not set");
    return;
  }

  const account = KeetaNet.lib.Account.fromSeed(
    await KeetaNet.lib.Account.seedFromPassphrase(process.env.CLIENT_PASSPHRASE),
    0
  );

  const clientKeetaSigner = toClientKeetaSigner(account);

  const client = new x402Client();
  registerExactKeetaScheme(client, { signer: clientKeetaSigner });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const response = await fetchWithPayment("http://localhost:4021/weather", {
    method: "GET",
  });

  const data = await response.json();
  console.log("Response:", data);

  // Get payment receipt from response headers
  if (response.ok) {
    const httpClient = new x402HTTPClient(client);
    const paymentResponse = httpClient.getPaymentSettleResponse(
      (name) => response.headers.get(name)
    );
    console.log("Payment settled", paymentResponse);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  });

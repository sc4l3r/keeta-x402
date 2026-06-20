# Paying via x402 on Keeta: agent integration guide

This guide covers everything a coding agent needs to make HTTP requests that pay
with Keeta tokens via the x402 protocol.

## How Keeta x402 works

See the [x402 Keeta exact scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_keeta.md) for the complete specification.

1. A client requests a resource on a resoure server.
2. The resource server responds with HTTP status 402 and attaches the payment requirements including the price for the resource.
3. The client creates a block with a SEND instruction fullfilling the server's requirements. It requests the resource again and attaches the signed block.
4. The resource server receives the block and calls the facilitator's `/verify` endpoint to verify the payment satisfies their requirements.
5. If the verification succeeds, the resource server calls the `/settle` endpoint on the facilitator which sponsors the fees by creating a fee block, collecting votes, and publishing the client's block and the fee block as a vote staple.
6. The resource server returns the requested resource together with a settlement receipt header.

The scheme is implemented in the official reference implementation available as `@x402/keeta` so client and server typically don't need to worry too much about the details.

## Install

```bash
npm install @x402/keeta @x402/core
```

## Client setup (paying agent)

```typescript
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactKeetaScheme, KEETA_TESTNET_CAIP2, toClientKeetaSigner } from "@x402/keeta";

// Derive the paying account which must be funded for successful payments.
const account = KeetaNet.lib.Account.fromSeed(
  await KeetaNet.lib.Account.seedFromPassphrase(process.env.CLIENT_PASSPHRASE),
  0,
);

// The signer holds open a UserClient and must be disposed when done.
await using clientKeetaSigner = toClientKeetaSigner(account);

const client = new x402Client();
// Register networks that should be supported by this client.
client.register(KEETA_TESTNET_CAIP2, new ExactKeetaScheme(clientKeetaSigner));
// For mainnet support do:
// client.register(KEETA_MAINNET_CAIP2, new ExactKeetaScheme(clientKeetaSigner));

// Wrap fetch with our x402 client which handles 402 responses transparently.
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Fetch a protected resource automatically paying for the requested costs.
const response = await fetchWithPayment("https://your-server.example/weather");
const data = await response.json();
```

A complete example is available at [apps/client/src/main.ts](../apps/client/src/main.ts).

> [!NOTE]
> When making a payment, the client creates and signs a block but **doesn't publish it**.
> Instead, the facilitator handles that for the server and sponsors the fees.
> Since Keeta uses an ordered per-account blockchain, the client **can't make multiple payments simultaneously**
> and must wait for the servers success response.
> Either queue requests that use the same account or use multiple accounts to parallelize requests.

## Resource server setup

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { KEETA_TESTNET_CAIP2, KTA_TESTNET_ADDRESS } from "@x402/keeta";
import { ExactKeetaScheme } from "@x402/keeta/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  // URL of the facilitator to use.
  // The server trusts this facilitator to operate according to the specification
  // and settle payments correctly so only use facilitators you trust.
  url: process.env.FACILITATOR_URL ?? "http://localhost:4022",
});

const server = new x402ResourceServer(facilitatorClient);
server.register(KEETA_TESTNET_CAIP2, new ExactKeetaScheme());

const payToAddress = process.env.SERVER_ADDRESS!;

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          // Define payment requirements for this route
          {
            scheme: "exact",
            // Default unit is in USDC (token address derived automatically for the Keeta network)
            price: "0.01",
            network: KEETA_TESTNET_CAIP2,
            payTo: payToAddress,
          },
          {
            scheme: "exact",
            // Can also accept payments in any other Keeta token
            price: {
              asset: KTA_TESTNET_ADDRESS,
              // Amount is the raw token amount without decimals.
              // For 9 decimals on the KTA testnet this equals 0.000001 KTA.
              amount: "1000",
            },
            network: KEETA_TESTNET_CAIP2,
            payTo: payToAddress,
          },
        ],
        description: "Current weather data",
        mimeType: "application/json",
      },
    },
    server,
  ),
);
```

A complete example is available in [apps/server/src/main.ts](,,/apps/server/src/main.ts).

## Testnet faucet

Get testnet KTA at <https://faucet.test.keeta.com/>.

## Further reading

- [x402 Keeta scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_keeta.md)
- [x402 buyer quickstart](https://docs.x402.org/getting-started/quickstart-for-buyers.md)
- [x402 seller quickstart](https://docs.x402.org/getting-started/quickstart-for-sellers.md)
- [npm: @x402/keeta](https://www.npmjs.com/package/@x402/keeta)

# Keeta x402

An implementation of the [x402 payment protocol](https://github.com/x402-foundation/x402) for [Keeta](https://keeta.com), with a production-ready facilitator and reference client/server apps.

- **Instant Settlement**: The server settles the client's payment immediately, ensuring that they received the payment before returning the requested resource.
- **Pay in any Keeta token**: Servers can take payments in any token on Keeta, be it KTA, USDC, memes, or even fiat tokens.
- **Easy integration**: The reference implementation for x402 on Keeta is integrated into the [official x402 library](https://github.com/x402-foundation/x402/tree/main/typescript/packages/mechanisms/keeta) with support for Axios and fetch clients and a variety of server frameworks such as Express.js and Next.js.

## Getting Started

- For Buyers: See the [x402 Quickstart for Buyers](https://docs.x402.org/getting-started/quickstart-for-buyers#keeta) and the example client in [apps/client](apps/client/src/main.ts).
- For Sellers: See the [x402 Quickstart for Sellers](https://docs.x402.org/getting-started/quickstart-for-sellers) and the example server in [apps/server](apps/server/src/main.ts).

The facilitator implementation in this repository is hosted at <https://facilitator.x402.kee.tools/> and contains an interactive example to complete an x402 payment on Keeta.

## How x402 works on Keeta

1. A client requests a resource on a resoure server.
2. The resource server responds with HTTP status 402 and attaches the payment requirements including the price for the resource.
3. The client creates a block with a SEND instruction fullfilling the server's requirements. It requests the resource again and attaches the signed block.
4. The resource server receives the block and calls the facilitator's `/verify` endpoint to verify the payment satisfies their requirements.
5. If the verification succeeds, the resource server calls the `/settle` endpoint on the facilitator which sponsors the fees by creating a fee block, collecting votes, and publishing the client's block and the fee block as a vote staple.
6. The resource server returns the requested resource together with a settlement receipt header.

The complete protocol is defined in the
[x402 Keeta exact scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_keeta.md).

## Components of this repository

| Role                      | App                | Key env vars                                                         |
| ------------------------- | ------------------ | -------------------------------------------------------------------- |
| Client (payer)            | `apps/client`      | `CLIENT_PASSPHRASE`                                                  |
| Protected resource server | `apps/server`      | `SERVER_ADDRESS`, `FACILITATOR_URL`                                  |
| Facilitator               | `apps/facilitator` | `FACILITATOR_PASSPHRASE`, `KEETA_NETWORKS`, `SERVER_ADDRESS`, `PORT` |

## Requirements

- Node.js 22+
- pnpm 10+

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

Fund the facilitator and client accounts with testnet KTA before running.
Use the [Keeta testnet faucet](https://faucet.test.keeta.com/) to request tokens.
Each network listed in `KEETA_NETWORKS` must be funded separately.

## Running

The apps can be run in multiple ways depending on the use case.

### Local development

Start all three services in separate terminals:

```bash
pnpm facilitator      # listens on :4022
pnpm resource-server  # listens on :4021
pnpm client           # makes one paid request then exits
```

The client prints the settlement response on success:

```js
{
  success: true,
  transaction: '<vote staple hash>',
  network: 'keeta:1413829460',
  payer: '<client address>'
}
```

### Local Docker build

Build and start the services in Docker containers:

```bash
docker compose -f compose.dev.yaml up
```

### Docker Compose

Start the facilitator using the image published in the GHCR:

```bash
docker compose up
```

Requires `.env` with at least `FACILITATOR_PASSPHRASE` set.

## Facilitator

The facilitator implementation in [`apps/facilitator`](apps/facilitator) has a few additional features compare to a stock facilitator:

- **Multi-network support**: `KEETA_NETWORKS=test,main` (the default) registers a payment scheme for both testnet and mainnet. Set `KEETA_NETWORKS=test` for testnet-only, or `KEETA_NETWORKS=main` for mainnet-only.
- **Bundled resource server**: When testnet enabled, the facilitator automatically provides a `/weather` demo route clients can use for testing. Set `SERVER_ADDRESS=<your-payee-address>` to receive the micro-payments.
- **Dashboard**: The facilitator's index page serves a dashboard showing the fee-payer account addresses and their KTA balances on each enabled network.

## Agent integration

Coding agents that want to accept or pay via Keeta x402 see the [agent guide](./docs/agent-guide.md).

## Links

- [x402 Keeta scheme spec](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_keeta.md)
- [npm: @x402/keeta](https://www.npmjs.com/package/@x402/keeta)
- [Keeta testnet faucet](https://faucet.test.keeta.com/)

# Keeta x402

An example of how to use the `@x402/keeta` library as a client, server, and facilitator.

**Note**: The Keeta x402 integration is still work in progress.

## Requirements

Make sure you have `pnpm` and the NodeJS dependencies installed:

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in the values.
Make sure that the client and facilitator account are funded with testnet KTA.
Use the [Faucet](https://faucet.test.keeta.com/) to request testnet KTA for your accounts.

## Usage

1. Start the facilitator: `pnpm run facilitator`
1. Start the resource server: `pnpm run server`
1. Start the client to make a request to the server: `pnpm run client`

Once the client completed, you should see the payment settle response as the output:

```js
{
  success: true,
  transaction: '<vote staple hash>',
  network: 'keeta:1413829460',
  payer: '<client address>'
}
```

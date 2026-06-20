/**
 * Request testnet KTA from the faucet for the given address.
 * Throws an `Error` if the HTTP response is not OK.
 *
 * @param address - The Keeta account address to fund.
 * @param amount  - The amount to request as a string (e.g. "1").
 * @throws Error when the faucet returns a non-2xx status.
 */
export async function requestFaucet(address: string, amount: string): Promise<void> {
  const params = new URLSearchParams();
  params.append("address", address);
  params.append("amount", amount);

  const resp = await fetch("https://faucet.test.keeta.com", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    throw new Error(`Faucet returned ${resp.status}`);
  }
}

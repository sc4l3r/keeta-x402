import * as KeetaNet from "@keetanetwork/keetanet-client";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";

export async function deriveAccounts(
  passphrase: string,
  count: number,
  logger: InstanceType<typeof Logger>,
): Promise<InstanceType<typeof KeetaNet.lib.Account>[]> {
  const accounts: InstanceType<typeof KeetaNet.lib.Account>[] = [];
  for (let i = 0; i < count; i++) {
    const account = KeetaNet.lib.Account.fromSeed(
      await KeetaNet.lib.Account.seedFromPassphrase(passphrase),
      i,
    );
    accounts.push(account);
    logger.info("accounts", ` - [${i}] ${account.publicKeyString.toString()}`);
  }
  return accounts;
}

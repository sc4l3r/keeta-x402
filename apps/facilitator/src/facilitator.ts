import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorKeetaSigner } from "@x402/keeta";
import { ExactKeetaScheme as FacilitatorExactKeetaScheme } from "@x402/keeta/exact/facilitator";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { NetworkIDs } from "./config.js";

export function buildFacilitator(
  accounts: InstanceType<typeof KeetaNet.lib.Account>[],
  enabledNetworks: NetworkIDs[],
  logger: InstanceType<typeof Logger>,
): InstanceType<typeof x402Facilitator> {
  const keetaSigner = toFacilitatorKeetaSigner(accounts);

  const facilitator = new x402Facilitator()
    .onBeforeVerify(async (context) => {
      logger.debug("facilitator", "Before verify", context);
    })
    .onAfterVerify(async (context) => {
      logger.debug("facilitator", "After verify", context);
    })
    .onVerifyFailure(async (context) => {
      logger.error("facilitator", "Verify failure", context);
    })
    .onBeforeSettle(async (context) => {
      logger.debug("facilitator", "Before settle", context);
    })
    .onAfterSettle(async (context) => {
      logger.debug("facilitator", "Transaction settled", context);
    })
    .onSettleFailure(async (context) => {
      logger.error("facilitator", "Settle failure", context);
    });

  for (const { caip2 } of enabledNetworks) {
    facilitator.register(caip2, new FacilitatorExactKeetaScheme(keetaSigner));
  }

  return facilitator;
}

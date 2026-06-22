import { SettlementQueue } from "@x402/keeta/exact/facilitator";
import type { Network } from "@x402/core/types";
import { incSettlementQueueDepth, decSettlementQueueDepth } from "./metrics.js";

/**
 * A {@link SettlementQueue} subclass that records per-fee-payer in-flight queue
 * depth. It increments the settlement queue depth gauge when a block is
 * enqueued and decrements it once settlement settles or rejects.
 */
export class InstrumentedSettlementQueue extends SettlementQueue {
  override async enqueue(
    feePayer: string,
    encodedBlock: string,
    network: Network,
  ): Promise<string> {
    incSettlementQueueDepth(feePayer, network);
    try {
      return await super.enqueue(feePayer, encodedBlock, network);
    } finally {
      decSettlementQueueDepth(feePayer, network);
    }
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";

import { stableHash } from "../core/hash.js";
import { redactSecrets } from "../core/redact.js";
import type { CrooDelivery, CrooOrder } from "./delivery.js";

export type CrooEvidenceStage =
  | "negotiation_created"
  | "negotiation_accepted"
  | "order_paid"
  | "order_delivered"
  | "order_failed"
  | "order_recovered"
  | "order_reconcile_skipped"
  | "a2a_workbench_negotiation_created"
  | "a2a_workbench_order_paid"
  | "a2a_workbench_delivery_received"
  | "a2a_workbench_failed";

export type CrooOrderEvidence = {
  a2aCapabilityId?: string;
  a2aNegotiationId?: string;
  a2aOrderId?: string;
  a2aProviderAgentId?: string;
  a2aServiceId?: string;
  capabilityId?: string;
  deliveryHash?: string;
  error?: string;
  generatedAt: string;
  inputHash?: string;
  negotiationId?: string;
  orderId?: string;
  serviceId?: string;
  settlementMode?: "escrow" | "fund-transfer";
  sourceCount?: number;
  stage: CrooEvidenceStage;
};

type EvidenceOptions = {
  filePath?: string;
  now?: Date;
};

export async function appendCrooOrderEvidence(
  evidence: Omit<CrooOrderEvidence, "generatedAt">,
  options: EvidenceOptions = {}
): Promise<CrooOrderEvidence | undefined> {
  if (process.env.LANGCLAW_CROO_EVIDENCE_DISABLED === "true") {
    return undefined;
  }

  const record: CrooOrderEvidence = {
    ...evidence,
    generatedAt: (options.now ?? new Date()).toISOString(),
  };
  const targetPath = options.filePath ?? readEvidenceLogPath();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.appendFile(targetPath, `${JSON.stringify(redactEvidence(record))}\n`, "utf8");
  return record;
}

export function evidenceForOrder(
  stage: CrooEvidenceStage,
  order: CrooOrder,
  extra: Partial<Omit<CrooOrderEvidence, "stage" | "generatedAt" | "inputHash" | "capabilityId" | "serviceId">> = {}
): Omit<CrooOrderEvidence, "generatedAt"> {
  return {
    stage,
    orderId: extra.orderId ?? order.id,
    negotiationId: extra.negotiationId,
    capabilityId: order.capabilityId,
    serviceId: order.serviceId,
  inputHash: stableHash(order.input),
    settlementMode: extra.settlementMode,
    deliveryHash: extra.deliveryHash,
    sourceCount: extra.sourceCount,
    error: extra.error,
    a2aCapabilityId: extra.a2aCapabilityId,
    a2aNegotiationId: extra.a2aNegotiationId,
    a2aOrderId: extra.a2aOrderId,
    a2aProviderAgentId: extra.a2aProviderAgentId,
    a2aServiceId: extra.a2aServiceId,
  };
}

export function evidenceForDelivery(
  order: CrooOrder,
  delivery: CrooDelivery,
  extra: Partial<Omit<CrooOrderEvidence, "stage" | "generatedAt" | "inputHash" | "capabilityId" | "serviceId">> = {}
): Omit<CrooOrderEvidence, "generatedAt"> {
  return evidenceForOrder("order_delivered", order, {
    ...extra,
    deliveryHash: delivery.proof.deliveryHash,
    sourceCount: delivery.proof.sourceCount,
  });
}

function readEvidenceLogPath(): string {
  return path.resolve(process.env.LANGCLAW_CROO_EVIDENCE_LOG_PATH?.trim() || path.join("data", "croo-order-evidence.jsonl"));
}

function redactEvidence(record: CrooOrderEvidence): CrooOrderEvidence {
  const serialized = redactSecrets(JSON.stringify(record));
  return JSON.parse(serialized) as CrooOrderEvidence;
}

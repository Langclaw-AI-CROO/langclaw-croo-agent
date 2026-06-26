import { AgentClient } from "@croo-network/sdk";
import type { Delivery, Negotiation, Order } from "@croo-network/sdk/dist/types.js";

import { stableHash } from "../core/hash.js";
import { redactSecrets } from "../core/redact.js";
import type { ResearchOutput } from "../core/types.js";
import type { CrooOrder } from "./delivery.js";
import type { CrooEvidenceStage } from "./evidence.js";

export const DEFAULT_A2A_WORKBENCH_PROVIDER_AGENT_ID = "0ad53b08-34bf-47a3-870f-5be9eaca0262";
export const DEFAULT_A2A_WORKBENCH_SERVICE_ID = "a8f1c20d-73f4-4551-856a-32315e18d261";
export const DEFAULT_A2A_WORKBENCH_CAPABILITY_ID = "universal.workbench.agent";

export type A2AWorkPack = {
  actionSteps: string[];
  deliveryHash?: string;
  evidenceChecklist: string[];
  orderId?: string;
  providerAgentId: string;
  reusePlan: string[];
  serviceId: string;
  status: "completed";
  summary: string;
};

export type A2AWorkbenchEvidenceEvent = {
  deliveryHash?: string;
  error?: string;
  negotiationId?: string;
  orderId?: string;
  payTxHash?: string;
  stage: Extract<
    CrooEvidenceStage,
    | "a2a_workbench_negotiation_created"
    | "a2a_workbench_order_paid"
    | "a2a_workbench_delivery_received"
    | "a2a_workbench_failed"
  >;
};

export type A2AWorkbenchRun = {
  events: A2AWorkbenchEvidenceEvent[];
  workPack: A2AWorkPack;
};

export type A2AWorkbenchRunnerInput = {
  client: A2AWorkbenchClient;
  order: CrooOrder;
  result: ResearchOutput;
};

export type A2AWorkbenchClient = Pick<AgentClient, "getDelivery" | "listOrders" | "negotiateOrder" | "payOrder">;

type A2AWorkbenchConfig = {
  capabilityId: string;
  maxInputChars: number;
  serviceId: string;
  timeoutMs: number;
};

export async function hireA2AWorkbench(input: A2AWorkbenchRunnerInput): Promise<A2AWorkbenchRun> {
  const config = readA2AWorkbenchConfig();
  const events: A2AWorkbenchEvidenceEvent[] = [];
  const requirements = JSON.stringify(buildWorkbenchPrompt(input.order, input.result, config.maxInputChars));
  const negotiation = await input.client.negotiateOrder({
    serviceId: config.serviceId,
    requirements,
  });
  events.push({
    negotiationId: negotiation.negotiationId,
    stage: "a2a_workbench_negotiation_created",
  });

  const createdOrder = await waitForWorkbenchOrder(input.client, config, negotiation, [
    "created",
    "paying",
    "paid",
    "delivering",
    "completed",
  ]);
  let paidOrder = createdOrder;
  let payTxHash = createdOrder.payTxHash || undefined;
  if (!isPostPaymentStatus(createdOrder.status)) {
    const payment = await input.client.payOrder(createdOrder.orderId);
    paidOrder = payment.order;
    payTxHash = payment.txHash || payment.order.payTxHash || payTxHash;
  }
  events.push({
    negotiationId: negotiation.negotiationId,
    orderId: paidOrder.orderId,
    payTxHash,
    stage: "a2a_workbench_order_paid",
  });

  const completedOrder = isCompletedStatus(paidOrder.status)
    ? paidOrder
    : await waitForWorkbenchOrder(input.client, config, negotiation, ["completed"]);
  const delivery = await input.client.getDelivery(completedOrder.orderId);
  const workPack = buildA2AWorkPack(delivery, completedOrder, config);
  events.push({
    deliveryHash: workPack.deliveryHash,
    negotiationId: negotiation.negotiationId,
    orderId: completedOrder.orderId,
    stage: "a2a_workbench_delivery_received",
  });

  return { events, workPack };
}

export function isA2AWorkbenchEnabled(): boolean {
  return readBoolean(process.env.LANGCLAW_A2A_WORKBENCH_ENABLED, false);
}

export function isA2AWorkbenchRequired(): boolean {
  return readBoolean(process.env.LANGCLAW_A2A_WORKBENCH_REQUIRED, false);
}

function readA2AWorkbenchConfig(): A2AWorkbenchConfig {
  return {
    capabilityId: process.env.LANGCLAW_A2A_WORKBENCH_CAPABILITY_ID?.trim() || DEFAULT_A2A_WORKBENCH_CAPABILITY_ID,
    maxInputChars: readPositiveInt(process.env.LANGCLAW_A2A_WORKBENCH_MAX_INPUT_CHARS, 8000),
    serviceId: process.env.LANGCLAW_A2A_WORKBENCH_SERVICE_ID?.trim() || DEFAULT_A2A_WORKBENCH_SERVICE_ID,
    timeoutMs: readPositiveInt(process.env.LANGCLAW_A2A_WORKBENCH_TIMEOUT_MS, 180000),
  };
}

function buildWorkbenchPrompt(order: CrooOrder, result: ResearchOutput, maxChars: number): string {
  const smartRows = result.onchain?.smartMoney?.sourceRows.slice(0, 6).map((row) => ({
    evidenceId: row.evidenceId,
    netUsd: row.netUsd,
    tokenSymbol: row.tokenSymbol,
    trades: row.trades,
    wallet: row.wallet,
    window: row.window,
  }));
  const payload = {
    task: "Create a Universal Work Pack from this Langclaw onchain intelligence result. Return action steps, evidence checklist, and A2A reuse plan.",
    langclawOrderId: order.id,
    query: order.input.topic,
    chain: order.input.chain,
    timeframe: order.input.timeframe,
    summary: result.summary,
    recommendation: result.recommendation,
    confidence: result.confidence,
    keyBullets: result.onchain?.bullets.slice(0, 6) ?? [],
    risks: result.onchain?.riskFlags.slice(0, 6).map((risk) => `${risk.label}: ${risk.detail}`) ?? [],
    smartMoneyRows: smartRows ?? [],
    sources: result.sources.slice(0, 6).map((source) => ({
      title: source.title,
      url: source.url,
    })),
    output: {
      summary: "short work-pack summary",
      actionSteps: ["agent-ready action step"],
      evidenceChecklist: ["evidence item to verify"],
      reusePlan: ["how another agent can reuse this result"],
    },
  };
  const text = JSON.stringify(payload);
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[trimmed]` : text;
}

function buildA2AWorkPack(delivery: Delivery, order: Order, config: A2AWorkbenchConfig): A2AWorkPack {
  const content = readDeliveryContent(delivery);
  const parsed = parseDeliveryContent(content);
  const deliveryHash = delivery.contentHash || stableHash(content);
  return {
    actionSteps: parsed.actionSteps,
    deliveryHash,
    evidenceChecklist: parsed.evidenceChecklist,
    orderId: order.orderId,
    providerAgentId: order.providerAgentId || delivery.providerAgentId || DEFAULT_A2A_WORKBENCH_PROVIDER_AGENT_ID,
    reusePlan: parsed.reusePlan,
    serviceId: config.serviceId,
    status: "completed",
    summary: parsed.summary || "Universal Workbench returned an action pack for this intelligence result.",
  };
}

function readDeliveryContent(delivery: Delivery): string {
  return redactSecrets(delivery.deliverableSchema || delivery.deliverableText || "");
}

function parseDeliveryContent(content: string): Pick<A2AWorkPack, "actionSteps" | "evidenceChecklist" | "reusePlan" | "summary"> {
  const parsed = parseJsonLike(content);
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    return {
      actionSteps: readStringArray(record.actionSteps ?? record.actions ?? record.steps).slice(0, 8),
      evidenceChecklist: readStringArray(record.evidenceChecklist ?? record.checklist ?? record.evidence).slice(0, 8),
      reusePlan: readStringArray(record.reusePlan ?? record.recommendedUses ?? record.agentReuse).slice(0, 8),
      summary: sanitizeText(readNestedString(record.summary ?? record.result ?? record.title) || "", 360),
    };
  }

  const lines = content
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  return {
    actionSteps: lines.slice(1, 5),
    evidenceChecklist: [],
    reusePlan: [],
    summary: sanitizeText(lines[0] || content, 360),
  };
}

function parseJsonLike(content: string): unknown {
  if (!content.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed === "string") {
      return parseJsonLike(parsed);
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => readNestedString(entry)).filter((entry): entry is string => Boolean(entry));
  }
  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((entry) => sanitizeText(entry.replace(/^[-*]\s*/, ""), 220))
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((entry) => readNestedString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  return [];
}

function readNestedString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return sanitizeText(value, 260);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readNestedString(record.text ?? record.label ?? record.title ?? record.summary ?? record.description);
  }
  return undefined;
}

async function waitForWorkbenchOrder(
  client: A2AWorkbenchClient,
  config: A2AWorkbenchConfig,
  negotiation: Negotiation,
  acceptedStatuses: string[]
): Promise<Order> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < config.timeoutMs) {
    const orders = await client.listOrders({ role: "buyer", page: 1, pageSize: 50 });
    const order = orders.find(
      (candidate) =>
        candidate.negotiationId === negotiation.negotiationId &&
        candidate.serviceId === config.serviceId &&
        acceptedStatuses.includes(normalizeStatus(candidate.status))
    );
    if (order) {
      return order;
    }
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for Universal Workbench order for negotiation ${negotiation.negotiationId}.`);
}

function isPostPaymentStatus(status: string): boolean {
  return ["paid", "delivering", "evaluating", "completed", "delivered"].includes(normalizeStatus(status));
}

function isCompletedStatus(status: string): boolean {
  return ["completed", "delivered"].includes(normalizeStatus(status));
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || !value.trim()) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function sanitizeText(value: string, maxLength: number): string {
  const clean = redactSecrets(value).replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

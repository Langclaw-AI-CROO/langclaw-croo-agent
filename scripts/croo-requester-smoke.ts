import "dotenv/config";

import { promises as fs } from "node:fs";
import path from "node:path";

import { AgentClient, EventType } from "@croo-network/sdk";
import type { Delivery, Event, Order } from "@croo-network/sdk/dist/types.js";
import type { EventStream } from "@croo-network/sdk/dist/ws.js";
import { stableHash } from "../src/core/hash.js";
import { redactSecrets } from "../src/core/redact.js";

type SmokeSummary = {
  capabilityId: string;
  command: string;
  contentHash?: string;
  deliverTxHash?: string;
  deliveryId?: string;
  deliveryPreviewHash?: string;
  deliveryStatus?: string;
  generatedAt: string;
  negotiationId: string;
  orderId?: string;
  orderStatus?: string;
  paid: boolean;
  paymentToken?: string;
  payTxHash?: string;
  price?: string;
  providerAgentId?: string;
  providerWalletAddress?: string;
  requesterAgentId?: string;
  requesterWalletAddress?: string;
  serviceId: string;
};

type SmokeConfig = {
  apiUrl: string;
  capabilityId: string;
  chain: string;
  command: string;
  existingOrderId?: string;
  outputPath: string;
  pay: boolean;
  prompt: string;
  requirementsType: "json" | "text";
  requesterKey: string;
  rpcUrl?: string;
  serviceId: string;
  scope: string;
  targetUse: string;
  timeframe: string;
  timeoutMs: number;
  useWebSocket: boolean;
  wsUrl: string;
};

async function main(): Promise<void> {
  const config = readSmokeConfig();
  const client = new AgentClient(
    {
      baseURL: config.apiUrl,
      wsURL: config.wsUrl,
      rpcURL: config.rpcUrl,
      logger: createRedactingLogger(),
    },
    config.requesterKey
  );
  const stream = config.useWebSocket ? await client.connectWebSocket() : undefined;
  let negotiationId = "";

  try {
    const createdOrder = config.existingOrderId
      ? await client.getOrder(config.existingOrderId)
      : await createOrderFromNegotiation(stream, client, config);
    negotiationId = createdOrder.negotiationId;
    let paidOrder = createdOrder;
    let payTxHash = createdOrder.payTxHash || undefined;

    if (config.pay && !isPostPaymentStatus(createdOrder.status)) {
      const payment = await client.payOrder(createdOrder.orderId);
      paidOrder = payment.order;
      payTxHash = payment.txHash || payment.order.payTxHash || payTxHash;
    }

    let completedOrder: Order | undefined;
    let delivery: Delivery | undefined;
    if (config.pay) {
      const delivered = await waitForOrderDelivery(client, config, negotiationId, paidOrder);
      completedOrder = delivered.order;
      delivery = delivered.delivery;
    }

    const summary = buildSummary({
      command: config.command,
      config,
      delivery,
      negotiationId,
      order: completedOrder ?? paidOrder,
      paid: config.pay,
      payTxHash,
    });
    await writeSummary(config.outputPath, summary);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    stream?.close();
  }
}

function readSmokeConfig(): SmokeConfig {
  const apiUrl = requiredEnv("CROO_API_URL");
  const wsUrl = requiredEnv("CROO_WS_URL");
  const requesterKey = readRequesterKey();
  const serviceId = requiredEnv("CROO_TARGET_SERVICE_ID");
  const existingOrderId = process.env.CROO_SMOKE_ORDER_ID?.trim() || undefined;
  const capabilityId = process.env.CROO_SMOKE_CAPABILITY_ID?.trim() || "langclaw.onchain.intelligence";
  const chain = process.env.CROO_SMOKE_CHAIN?.trim() || "base";
  const prompt = process.env.CROO_SMOKE_PROMPT?.trim() || "Run smart money accumulation on Base last 7 days.";
  const scope = process.env.CROO_SMOKE_SCOPE?.trim() || "chain";
  const targetUse = process.env.CROO_SMOKE_TARGET_USE?.trim() || "agent-context";
  const timeframe = process.env.CROO_SMOKE_TIMEFRAME?.trim() || "7d";
  const pay = readBoolean(process.env.CROO_SMOKE_PAY, true);
  const requirementsType = readRequirementsType(process.env.CROO_SMOKE_REQUIREMENTS_TYPE, capabilityId);
  const timeoutMs = readPositiveInt(process.env.CROO_SMOKE_TIMEOUT_MS, 180000);
  const useWebSocket = readBoolean(process.env.CROO_SMOKE_USE_WS, false);
  const outputPath = path.resolve(process.env.CROO_REQUESTER_SMOKE_OUTPUT_PATH?.trim() || path.join("data", "croo-requester-smoke.json"));

  return {
    apiUrl,
    capabilityId,
    chain,
    command: process.env.CROO_SMOKE_COMMAND_LABEL?.trim() || "node --import tsx scripts/croo-requester-smoke.ts",
    existingOrderId,
    outputPath,
    pay,
    prompt,
    requirementsType,
    requesterKey,
    rpcUrl: process.env.BASE_RPC_URL?.trim() || undefined,
    serviceId,
    scope,
    targetUse,
    timeframe,
    timeoutMs,
    useWebSocket,
    wsUrl,
  };
}

async function createOrderFromNegotiation(
  stream: EventStream | undefined,
  client: AgentClient,
  config: SmokeConfig
): Promise<Order> {
  const negotiation = await client.negotiateOrder({
    serviceId: config.serviceId,
    requirements: buildRequirementsPayload(config),
  });
  return waitForOrderState(stream, client, EventType.OrderCreated, config, negotiation.negotiationId, [
    "created",
    "paying",
    "paid",
    "completed",
  ]);
}

function readRequesterKey(): string {
  const requesterKey = process.env.CROO_REQUESTER_SDK_KEY?.trim();
  if (requesterKey) {
    return requesterKey;
  }

  const sdkKey = process.env.CROO_SDK_KEY?.trim();
  if (sdkKey) {
    return sdkKey;
  }

  throw new Error("CROO_REQUESTER_SDK_KEY or CROO_SDK_KEY is required for requester smoke mode.");
}

function buildRequirementsPayload(config: SmokeConfig): string {
  if (config.requirementsType === "text") {
    return JSON.stringify(config.prompt);
  }

  return JSON.stringify(buildRequirements(config));
}

function buildRequirements(config: SmokeConfig): Record<string, unknown> {
  if (config.capabilityId === "langclaw.onchain.intelligence") {
    return {
      capabilityId: config.capabilityId,
      research_prompt: config.prompt,
      chain: config.chain,
      scope: config.scope,
      timeframe: config.timeframe,
      targetUse: config.targetUse,
      responseLanguage: "en",
    };
  }

  return {
    capabilityId: config.capabilityId,
    topic: config.prompt,
    chain: config.chain,
    targetUse: config.targetUse,
    responseLanguage: "en",
  };
}

function waitForOrderState(
  stream: EventStream | undefined,
  client: AgentClient,
  eventType: string,
  config: SmokeConfig,
  negotiationId: string,
  acceptedStatuses: string[]
): Promise<Order> {
  let done = false;
  const eventOrder = stream
    ? new Promise<Order>((resolve) => {
        stream.on(eventType, async (event: Event) => {
          if (done || !event.order_id) {
            return;
          }
          try {
            const order = await client.getOrder(event.order_id);
            if (!matchesSmokeOrder(order, config, negotiationId) || !acceptedStatuses.includes(order.status)) {
              return;
            }
            done = true;
            resolve(order);
          } catch (error) {
            console.warn(`Ignored ${eventType} lookup failure.`, error instanceof Error ? error.message : error);
          }
        });
      })
    : new Promise<Order>(() => undefined);
  const polledOrder = pollOrderForNegotiation(client, config, negotiationId, acceptedStatuses, () => done);
  return Promise.race([eventOrder, polledOrder]).then((order) => {
    done = true;
    return order;
  });
}

async function pollOrderForNegotiation(
  client: AgentClient,
  config: SmokeConfig,
  negotiationId: string,
  acceptedStatuses: string[],
  isDone: () => boolean
): Promise<Order> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < config.timeoutMs) {
    if (isDone()) {
      return new Promise<Order>(() => undefined);
    }
    const orders = await client.listOrders({ role: "buyer", page: 1, pageSize: 50 });
    const order = orders.find(
      (candidate) =>
        candidate.negotiationId === negotiationId &&
        candidate.serviceId === config.serviceId &&
        acceptedStatuses.includes(candidate.status)
    );
    if (order) {
      return order;
    }
    await sleep(3000);
  }
  throw new Error(`Timed out polling order for negotiation ${negotiationId}.`);
}

async function waitForOrderDelivery(
  client: AgentClient,
  config: SmokeConfig,
  negotiationId: string,
  initialOrder: Order
): Promise<{ delivery: Delivery; order: Order }> {
  const startedAt = Date.now();
  let latestOrder = initialOrder;
  while (Date.now() - startedAt < config.timeoutMs) {
    const delivery = await readAcceptedDelivery(client, latestOrder.orderId);
    if (delivery) {
      return { delivery, order: latestOrder };
    }

    if (isCompletedStatus(latestOrder.status)) {
      const completedDelivery = await client.getDelivery(latestOrder.orderId);
      return { delivery: completedDelivery, order: latestOrder };
    }

    const orders = await client.listOrders({ role: "buyer", page: 1, pageSize: 50 });
    const order = orders.find((candidate) => matchesSmokeOrder(candidate, config, negotiationId));
    if (order) {
      latestOrder = order;
    }
    await sleep(3000);
  }
  throw new Error(`Timed out polling delivery for negotiation ${negotiationId}.`);
}

async function readAcceptedDelivery(client: AgentClient, orderId: string): Promise<Delivery | undefined> {
  try {
    const delivery = await client.getDelivery(orderId);
    return isDeliveryAccepted(delivery.status) ? delivery : undefined;
  } catch {
    return undefined;
  }
}

function matchesSmokeOrder(order: Order, config: SmokeConfig, negotiationId: string): boolean {
  if (order.serviceId !== config.serviceId) {
    return false;
  }
  return !negotiationId || order.negotiationId === negotiationId;
}

function isPostPaymentStatus(status: string): boolean {
  return ["paid", "delivering", "evaluating", "completed", "delivered"].includes(normalizeStatus(status));
}

function isCompletedStatus(status: string): boolean {
  return ["completed", "delivered"].includes(normalizeStatus(status));
}

function isDeliveryAccepted(status: string): boolean {
  return ["submitted", "accepted"].includes(normalizeStatus(status));
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function buildSummary(input: {
  command: string;
  config: SmokeConfig;
  delivery?: Delivery;
  negotiationId: string;
  order: Order;
  paid: boolean;
  payTxHash?: string;
}): SmokeSummary {
  return {
    capabilityId: input.config.capabilityId,
    command: input.command,
    contentHash: input.delivery?.contentHash || undefined,
    deliverTxHash: input.order.deliverTxHash || undefined,
    deliveryId: input.delivery?.deliveryId,
    deliveryPreviewHash: deliveryPayload(input.delivery) ? stableHash(deliveryPayload(input.delivery)) : undefined,
    deliveryStatus: input.delivery?.status,
    generatedAt: new Date().toISOString(),
    negotiationId: input.negotiationId,
    orderId: input.order.orderId,
    orderStatus: input.order.status,
    paid: input.paid,
    paymentToken: input.order.paymentToken || undefined,
    payTxHash: input.payTxHash || undefined,
    price: input.order.price || undefined,
    providerAgentId: input.order.providerAgentId || undefined,
    providerWalletAddress: input.order.providerWalletAddress || undefined,
    requesterAgentId: input.order.requesterAgentId || undefined,
    requesterWalletAddress: input.order.requesterWalletAddress || undefined,
    serviceId: input.order.serviceId || input.config.serviceId,
  };
}

function deliveryPayload(delivery: Delivery | undefined): string | undefined {
  return delivery?.deliverableSchema || delivery?.deliverableText || undefined;
}

async function writeSummary(outputPath: string, summary: SmokeSummary): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(redact(summary), null, 2)}\n`, "utf8");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || !value.trim()) {
    return fallback;
  }
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function readRequirementsType(value: string | undefined, capabilityId: string): "json" | "text" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "text" || normalized === "json") {
    return normalized;
  }
  return capabilityId === "universal.workbench.agent" ? "text" : "json";
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createRedactingLogger() {
  return {
    info: (message: string, ...args: unknown[]) => console.info(redactText(message), ...args.map(redact)),
    warn: (message: string, ...args: unknown[]) => console.warn(redactText(message), ...args.map(redact)),
    error: (message: string, ...args: unknown[]) => console.error(redactText(message), ...args.map(redact)),
    debug: (message: string, ...args: unknown[]) => console.debug(redactText(message), ...args.map(redact)),
  };
}

function redact<T>(value: T): T {
  if (typeof value === "string") {
    return redactText(value) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return JSON.parse(redactText(JSON.stringify(value))) as T;
}

function redactText(value: string): string {
  return redactSecrets(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import "dotenv/config";

import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";
import type { Delivery, Order } from "@croo-network/sdk/dist/types.js";
import { buildCapabilities, buildDelivery, buildLicenseDelivery, formatLicenseDeliveryText, type CrooCapabilityId, type CrooOrder } from "./delivery.js";
import { appendCrooOrderEvidence, evidenceForDelivery, evidenceForOrder } from "./evidence.js";
import {
  DEFAULT_A2A_WORKBENCH_CAPABILITY_ID,
  DEFAULT_A2A_WORKBENCH_PROVIDER_AGENT_ID,
  DEFAULT_A2A_WORKBENCH_SERVICE_ID,
  hireA2AWorkbench,
  isA2AWorkbenchEnabled,
  isA2AWorkbenchRequired,
  type A2AWorkbenchClient,
  type A2AWorkbenchRun,
  type A2AWorkbenchRunnerInput,
} from "./a2a-workbench.js";
import { redactSecrets, redactUnknown as redactUnknownValue } from "../core/redact.js";
import { runCrooResearchAgent } from "../core/run-research.js";
import type { AgentTargetUse, ResearchDepth, ResearchInput, ResearchMode, ResearchOutput, ResponseLanguage } from "../core/types.js";
import type { OnchainScope } from "../core/onchain/types.js";
import { LicenseStore } from "../license/store.js";

type UnknownRecord = Record<string, unknown>;

type CrooNegotiation = {
  fundAmount?: string;
  fundToken?: string;
};

type NegotiationAcceptor = {
  acceptNegotiation: (negotiationId: string) => Promise<unknown>;
  acceptNegotiationWithFundAddress: (negotiationId: string, providerFundAddress: string) => Promise<unknown>;
};

type PaidOrderClient = {
  deliverOrder: AgentClient["deliverOrder"];
  getDelivery: AgentClient["getDelivery"];
  getNegotiation: AgentClient["getNegotiation"];
  getOrder: AgentClient["getOrder"];
};

type ActiveOrderClient = PaidOrderClient & {
  listOrders: AgentClient["listOrders"];
};

type PaidOrderProcessorOptions = {
  a2aWorkbenchRunner?: (input: A2AWorkbenchRunnerInput) => Promise<A2AWorkbenchRun>;
  evidenceRecorder?: typeof recordCrooOrderEvidence;
  processingOrderIds?: Set<string>;
  researchRunner?: (input: ResearchInput) => Promise<ResearchOutput>;
};

const ACTIVE_PROVIDER_ORDER_STATUSES = ["paid", "delivering", "evaluating"] as const;
const TERMINAL_ORDER_STATUSES = new Set(["completed", "rejected", "expired"]);
const DELIVERY_PRESENT_STATUSES = new Set(["submitted", "accepted"]);
const DEFAULT_RECONCILE_INTERVAL_MS = 60000;
const DEFAULT_RECONCILE_PAGE_SIZE = 50;

export async function startCrooProvider(): Promise<void> {
  const mode = process.env.LANGCLAW_PROVIDER_MODE ?? "live";
  if (mode === "mock") {
    await runMockProvider();
    return;
  }

  assertLiveEnv();
  const client = new AgentClient(
    {
      baseURL: process.env.CROO_API_URL!,
      wsURL: process.env.CROO_WS_URL!,
      rpcURL: process.env.BASE_RPC_URL,
      logger: createRedactingLogger(),
    },
    readCrooKey()
  );
  const stream = await client.connectWebSocket();
  const negotiationInputs = new Map<string, CrooOrder>();
  const licenseStore = new LicenseStore();
  const processingOrderIds = new Set<string>();
  await reconcilePendingNegotiations(client, negotiationInputs);
  await reconcileActiveProviderOrders(client, negotiationInputs, licenseStore, {
    processingOrderIds,
  });
  const reconcileTimer = setInterval(() => {
    void reconcileActiveProviderOrders(client, negotiationInputs, licenseStore, {
      processingOrderIds,
    });
  }, readReconcileIntervalMs());
  reconcileTimer.unref?.();

  stream.on(EventType.NegotiationCreated, async (event) => {
    if (!event.negotiation_id) {
      return;
    }
    await processNegotiation(client, negotiationInputs, event.negotiation_id);
  });

  stream.on(EventType.OrderPaid, async (event) => {
    if (!event.order_id) {
      return;
    }
    await processPaidOrder(client, negotiationInputs, licenseStore, event.order_id, {
      processingOrderIds,
    });
  });

  process.on("SIGINT", () => {
    clearInterval(reconcileTimer);
    stream.close();
    process.exit(0);
  });
}

async function reconcilePendingNegotiations(client: AgentClient, negotiationInputs: Map<string, CrooOrder>): Promise<void> {
  try {
    const negotiations = await client.listNegotiations({
      role: "provider",
      status: "pending",
      page: 1,
      pageSize: 50,
    });
    for (const negotiation of negotiations) {
      await processNegotiation(client, negotiationInputs, negotiation.negotiationId);
    }
  } catch (error) {
    console.error("Failed to reconcile pending CROO negotiations.", safeErrorMessage(error));
  }
}

export async function reconcileActiveProviderOrders(
  client: ActiveOrderClient,
  negotiationInputs: Map<string, CrooOrder>,
  licenseStore: LicenseStore,
  options: PaidOrderProcessorOptions = {}
): Promise<void> {
  for (const status of ACTIVE_PROVIDER_ORDER_STATUSES) {
    let orders: Order[];
    try {
      orders = await client.listOrders({
        role: "provider",
        status,
        page: 1,
        pageSize: DEFAULT_RECONCILE_PAGE_SIZE,
      });
    } catch (error) {
      console.error(`Failed to reconcile CROO ${status} orders.`, safeErrorMessage(error));
      continue;
    }

    for (const order of orders) {
      await processPaidOrder(client, negotiationInputs, licenseStore, order.orderId, options);
    }
  }
}

export async function processPaidOrder(
  client: PaidOrderClient,
  negotiationInputs: Map<string, CrooOrder>,
  licenseStore: LicenseStore,
  orderId: string,
  options: PaidOrderProcessorOptions = {}
): Promise<void> {
  const processingOrderIds = options.processingOrderIds;
  const evidenceRecorder = options.evidenceRecorder ?? recordCrooOrderEvidence;
  const researchRunner = options.researchRunner ?? runCrooResearchAgent;
  if (processingOrderIds?.has(orderId)) {
    return;
  }
  processingOrderIds?.add(orderId);

  let chainOrder: Order | undefined;
  let order: CrooOrder | undefined;
  try {
    chainOrder = await client.getOrder(orderId);
    const status = normalizeStatus(chainOrder.status);
    const stored = negotiationInputs.get(chainOrder.negotiationId);
    order = stored ?? normalizeOrder(await client.getNegotiation(chainOrder.negotiationId));
    order.id = chainOrder.orderId;

    if (TERMINAL_ORDER_STATUSES.has(status)) {
      await evidenceRecorder(
        evidenceForOrder("order_reconcile_skipped", order, {
          negotiationId: chainOrder.negotiationId,
          orderId: chainOrder.orderId,
          error: `terminal_status:${status}`,
        })
      );
      return;
    }

    if (status === "delivering" || status === "evaluating") {
      const existingDelivery = await getExistingDelivery(client, chainOrder.orderId);
      if (existingDelivery && DELIVERY_PRESENT_STATUSES.has(normalizeStatus(existingDelivery.status))) {
        await evidenceRecorder(
          evidenceForOrder("order_recovered", order, {
            negotiationId: chainOrder.negotiationId,
            orderId: chainOrder.orderId,
            deliveryHash: existingDelivery.contentHash || undefined,
          })
        );
        return;
      }
    }

    await evidenceRecorder(
      evidenceForOrder("order_paid", order, {
        negotiationId: chainOrder.negotiationId,
        orderId: chainOrder.orderId,
      })
    );

    if (isLicenseOrder(order)) {
      const delivery = buildLicenseDelivery(order.id, createLicenseForOrder(licenseStore, order));
      await client.deliverOrder(chainOrder.orderId, {
        deliverableType: DeliverableType.Text,
        deliverableText: formatLicenseDeliveryText(delivery),
      });
      await evidenceRecorder(
        evidenceForOrder("order_delivered", order, {
          negotiationId: chainOrder.negotiationId,
          orderId: chainOrder.orderId,
        })
      );
      return;
    }

    const research = await researchRunner(order.input);
    const a2aWorkPack = await maybeRunA2AWorkbench(client, order, research, evidenceRecorder, options);
    const delivery = buildDelivery(order, research, { a2aWorkPack });
    await client.deliverOrder(chainOrder.orderId, {
      deliverableType: DeliverableType.Text,
      deliverableText: JSON.stringify(delivery),
    });
    await evidenceRecorder(
      evidenceForDelivery(order, delivery, {
        negotiationId: chainOrder.negotiationId,
        orderId: chainOrder.orderId,
      })
    );
  } catch (error) {
    if (order) {
      const recovered = await recoverExistingDelivery(client, order, chainOrder, evidenceRecorder);
      if (recovered) {
        return;
      }
      await evidenceRecorder(
          evidenceForOrder("order_failed", order, {
            negotiationId: chainOrder?.negotiationId,
            orderId: chainOrder?.orderId ?? orderId,
            error: safeErrorMessage(error),
          })
        );
      }
    console.error("Failed to process paid CROO order.", safeErrorMessage(error));
  } finally {
    processingOrderIds?.delete(orderId);
  }
}

async function maybeRunA2AWorkbench(
  client: PaidOrderClient,
  order: CrooOrder,
  result: ResearchOutput,
  evidenceRecorder: typeof recordCrooOrderEvidence,
  options: PaidOrderProcessorOptions
) {
  if (!isOnchainOrder(order) || !isA2AWorkbenchEnabled()) {
    return undefined;
  }

  const runner = options.a2aWorkbenchRunner ?? ((input: A2AWorkbenchRunnerInput) => hireA2AWorkbench(input));
  try {
    const run = await runner({
      client: client as unknown as A2AWorkbenchClient,
      order,
      result,
    });
    for (const event of run.events) {
      await evidenceRecorder(
        evidenceForOrder(event.stage, order, {
          a2aCapabilityId: DEFAULT_A2A_WORKBENCH_CAPABILITY_ID,
          a2aNegotiationId: event.negotiationId,
          a2aOrderId: event.orderId,
          a2aProviderAgentId: run.workPack.providerAgentId,
          a2aServiceId: run.workPack.serviceId,
          deliveryHash: event.deliveryHash,
          error: event.error,
        })
      );
    }
    return run.workPack;
  } catch (error) {
    await evidenceRecorder(
      evidenceForOrder("a2a_workbench_failed", order, {
        a2aCapabilityId: DEFAULT_A2A_WORKBENCH_CAPABILITY_ID,
        a2aProviderAgentId: DEFAULT_A2A_WORKBENCH_PROVIDER_AGENT_ID,
        a2aServiceId: DEFAULT_A2A_WORKBENCH_SERVICE_ID,
        error: safeErrorMessage(error),
      })
    );
    if (isA2AWorkbenchRequired()) {
      throw error;
    }
    return undefined;
  }
}

async function processNegotiation(client: AgentClient, negotiationInputs: Map<string, CrooOrder>, negotiationId: string): Promise<void> {
  let order: CrooOrder | undefined;
  try {
    const negotiation = await client.getNegotiation(negotiationId);
    if (negotiation.status && negotiation.status !== "pending") {
      return;
    }
    order = normalizeOrder(negotiation);
    negotiationInputs.set(negotiationId, order);
    await recordCrooOrderEvidence(
      evidenceForOrder("negotiation_created", order, {
        negotiationId,
        settlementMode: isFundTransferNegotiation(negotiation) ? "fund-transfer" : "escrow",
      })
    );
    await acceptNegotiationForSettlement(client, negotiationId, negotiation);
    await recordCrooOrderEvidence(
      evidenceForOrder("negotiation_accepted", order, {
        negotiationId,
        settlementMode: isFundTransferNegotiation(negotiation) ? "fund-transfer" : "escrow",
      })
    );
  } catch (error) {
    if (order) {
      await recordCrooOrderEvidence(
          evidenceForOrder("order_failed", order, {
            negotiationId,
            error: safeErrorMessage(error),
          })
        );
      }
    console.error("Failed to process CROO negotiation.", safeErrorMessage(error));
  }
}

async function recordCrooOrderEvidence(evidence: Parameters<typeof appendCrooOrderEvidence>[0]): Promise<void> {
  try {
    await appendCrooOrderEvidence(evidence);
  } catch (error) {
    console.warn("Failed to write CROO order evidence.", error instanceof Error ? error.message : error);
  }
}

async function recoverExistingDelivery(
  client: PaidOrderClient,
  order: CrooOrder,
  chainOrder: Order | undefined,
  evidenceRecorder: typeof recordCrooOrderEvidence
): Promise<boolean> {
  if (!chainOrder) {
    return false;
  }
  const delivery = await getExistingDelivery(client, chainOrder.orderId);
  if (!delivery || !DELIVERY_PRESENT_STATUSES.has(normalizeStatus(delivery.status))) {
    return false;
  }
  await evidenceRecorder(
    evidenceForOrder("order_recovered", order, {
      negotiationId: chainOrder.negotiationId,
      orderId: chainOrder.orderId,
      deliveryHash: delivery.contentHash || undefined,
    })
  );
  return true;
}

async function getExistingDelivery(client: PaidOrderClient, orderId: string): Promise<Delivery | undefined> {
  try {
    return await client.getDelivery(orderId);
  } catch {
    return undefined;
  }
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readReconcileIntervalMs(): number {
  const raw = process.env.LANGCLAW_CROO_RECONCILE_INTERVAL_MS?.trim();
  if (!raw) {
    return DEFAULT_RECONCILE_INTERVAL_MS;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RECONCILE_INTERVAL_MS;
}

function assertLiveEnv(): void {
  for (const key of ["CROO_API_URL", "CROO_WS_URL"]) {
    if (!process.env[key]?.trim()) {
      throw new Error(`${key} is required for live CROO provider mode.`);
    }
  }
  readCrooKey();
}

function readCrooKey(): string {
  const key = process.env.CROO_SDK_KEY?.trim() || process.env.CROO_API_KEY?.trim();
  if (!key) {
    throw new Error("CROO_SDK_KEY or CROO_API_KEY is required for live CROO provider mode.");
  }
  return key;
}

function createRedactingLogger() {
  return {
    info: (message: string, ...args: unknown[]) => console.info(redactSecret(message), ...args.map(redactUnknown)),
    warn: (message: string, ...args: unknown[]) => console.warn(redactSecret(message), ...args.map(redactUnknown)),
    error: (message: string, ...args: unknown[]) => console.error(redactSecret(message), ...args.map(redactUnknown)),
    debug: (message: string, ...args: unknown[]) => console.debug(redactSecret(message), ...args.map(redactUnknown)),
  };
}

function redactUnknown(value: unknown): unknown {
  return redactUnknownValue(value);
}

function redactSecret(value: string): string {
  return redactSecrets(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeErrorMessage(error: unknown): string {
  return redactSecrets(errorMessage(error));
}

export function normalizeOrder(rawOrder: unknown): CrooOrder {
  const payload = rawOrder && typeof rawOrder === "object" ? (rawOrder as UnknownRecord) : {};
  const parsedRequirements = parseRequirements(payload.requirements);
  const input =
    payload.input && typeof payload.input === "object"
      ? payload.input
      : parsedRequirements && typeof parsedRequirements === "object"
        ? parsedRequirements
        : payload;
  const id = String(payload.id ?? payload.orderId ?? payload.negotiationId ?? `order-${Date.now()}`);
  const serviceId = readString(payload.serviceId ?? (input as UnknownRecord).serviceId);
  const capabilityId = readCapabilityId(payload.capabilityId ?? (input as UnknownRecord).capabilityId) ?? capabilityIdForServiceId(serviceId);
  const mode = readResearchMode((input as UnknownRecord).mode) ?? (capabilityId === "langclaw.onchain.intelligence" ? "onchain-intelligence" : undefined);

  return {
    id,
    capabilityId,
    serviceId,
    input: {
      topic: readOrderPrompt(input as UnknownRecord),
      mode,
      chain: readString((input as UnknownRecord).chain),
      responseLanguage: readResponseLanguage((input as UnknownRecord).responseLanguage),
      maxDepth: readResearchDepth((input as UnknownRecord).maxDepth),
      context: readString((input as UnknownRecord).context),
      scope: readOnchainScope((input as UnknownRecord).scope),
      tokenAddress: readString((input as UnknownRecord).tokenAddress),
      walletAddress: readString((input as UnknownRecord).walletAddress),
      contractAddress: readString((input as UnknownRecord).contractAddress),
      transactionHash: readString((input as UnknownRecord).transactionHash),
      timeframe: readString((input as UnknownRecord).timeframe),
      targetUse: readTargetUse((input as UnknownRecord).targetUse),
    },
  };
}

function readOrderPrompt(input: UnknownRecord): string {
  return String(input.research_prompt ?? input.topic ?? input.query ?? input.prompt_research ?? input.prompt ?? "");
}

export async function acceptNegotiationForSettlement(
  client: NegotiationAcceptor,
  negotiationId: string,
  negotiation: CrooNegotiation
): Promise<unknown> {
  if (!isFundTransferNegotiation(negotiation)) {
    return client.acceptNegotiation(negotiationId);
  }
  const fundAddress = readProviderFundAddress();
  return client.acceptNegotiationWithFundAddress(negotiationId, fundAddress);
}

function isFundTransferNegotiation(negotiation: CrooNegotiation): boolean {
  return hasPositiveBaseUnitAmount(negotiation.fundAmount);
}

function hasPositiveBaseUnitAmount(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return false;
  }
  return BigInt(trimmed) > 0n;
}

function readProviderFundAddress(): string {
  const address = process.env.LANGCLAW_PROVIDER_FUND_ADDRESS?.trim() || process.env.CROO_PROVIDER_FUND_ADDRESS?.trim();
  if (!address) {
    throw new Error("LANGCLAW_PROVIDER_FUND_ADDRESS is required for CROO fund-transfer services.");
  }
  if (!isEvmAddress(address)) {
    throw new Error("LANGCLAW_PROVIDER_FUND_ADDRESS must be a valid EVM address.");
  }
  return address;
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function capabilityIdForServiceId(serviceId: string | undefined): CrooCapabilityId | undefined {
  if (!serviceId) {
    return undefined;
  }
  if (serviceId === licenseServiceId()) {
    return "langclaw.builder.pass.license";
  }
  if (serviceId === onchainServiceId()) {
    return "langclaw.onchain.intelligence";
  }
  return undefined;
}

function isLicenseOrder(order: CrooOrder): boolean {
  return order.capabilityId === "langclaw.builder.pass.license" || order.serviceId === licenseServiceId();
}

function isOnchainOrder(order: CrooOrder): boolean {
  return order.capabilityId === "langclaw.onchain.intelligence" || order.serviceId === onchainServiceId();
}

function licenseServiceId(): string {
  return process.env.LANGCLAW_LICENSE_SERVICE_ID?.trim() || "70b7b5d4-961b-47ba-97c6-a863b1c949c0";
}

function onchainServiceId(): string | undefined {
  return process.env.LANGCLAW_ONCHAIN_SERVICE_ID?.trim() || undefined;
}

function parseRequirements(value: unknown): UnknownRecord | undefined {
  if (value && typeof value === "object") {
    return value as UnknownRecord;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as UnknownRecord) : undefined;
  } catch {
    return { topic: value };
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readResearchMode(value: unknown): ResearchMode | undefined {
  return isOneOf(value, [
    "hackathon-fit",
    "protocol-research",
    "claim-verification",
    "market-brief",
    "onchain-intelligence",
  ]);
}

function readCapabilityId(value: unknown): CrooCapabilityId | undefined {
  return isOneOf(value, ["langclaw.research.brief", "langclaw.onchain.intelligence", "langclaw.builder.pass.license"]);
}

function readOnchainScope(value: unknown): OnchainScope | undefined {
  return isOneOf(value, [
    "chain",
    "token",
    "protocol",
    "wallet",
    "contract",
    "transaction",
    "bridge",
    "governance",
    "unknown",
  ]);
}

function readResponseLanguage(value: unknown): ResponseLanguage | undefined {
  return isOneOf(value, ["en", "id"]);
}

function readResearchDepth(value: unknown): ResearchDepth | undefined {
  return isOneOf(value, ["quick", "standard", "deep"]);
}

function readTargetUse(value: unknown): AgentTargetUse | undefined {
  return isOneOf(value, [
    "agent-context",
    "campaign-grounding",
    "market-brief",
    "token-due-diligence",
    "wallet-analysis",
    "protocol-research",
    "claim-verification",
    "hackathon-research",
  ]);
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T
): T[number] | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

async function runMockProvider(): Promise<void> {
  if (process.env.LANGCLAW_MOCK_CAPABILITY === "langclaw.builder.pass.license") {
    const order: CrooOrder = {
      id: "mock-license-order-1",
      capabilityId: "langclaw.builder.pass.license",
      input: {
        topic: "demo builder pass",
        responseLanguage: "en",
      },
    };
    const license = new LicenseStore({
      path: process.env.LANGCLAW_LICENSE_STORE_PATH,
    }).create({
      label: licenseLabelForOrder(order),
      sourceOrderId: order.id,
    });
    console.log(formatLicenseDeliveryText(buildLicenseDelivery(order.id, license)));
    return;
  }

  const order: CrooOrder = {
    id: "mock-order-1",
    capabilityId: "langclaw.onchain.intelligence",
    input: {
      topic: "Base chain TVL and liquidity activity today",
      mode: "onchain-intelligence",
      chain: "base",
      responseLanguage: "en",
    },
  };
  const result = await runCrooResearchAgent(order.input, {
    onchainExecutors: {
      "defillama.chain_tvl": async () => ({
        data: { tvl: 1 },
        sourceUrl: "https://example.test/chain-tvl",
        summary: "Mock chain TVL completed.",
      }),
      "defillama.stablecoins": async () => ({
        data: { stablecoins: 1 },
        sourceUrl: "https://example.test/stablecoins",
        summary: "Mock stablecoin supply completed.",
      }),
      "dexscreener.latest_profiles": async () => ({
        data: [],
        sourceUrl: "https://example.test/profiles",
        summary: "Mock token profiles completed.",
      }),
      "dexscreener.latest_boosts": async () => ({
        data: [],
        sourceUrl: "https://example.test/boosts",
        summary: "Mock latest boosts completed.",
      }),
      "dexscreener.top_boosts": async () => ({
        data: [],
        sourceUrl: "https://example.test/top-boosts",
        summary: "Mock top boosts completed.",
      }),
      "local.synthesis": async () => ({
        data: { done: true },
        summary: "Mock synthesis completed.",
      }),
    },
  });
  const delivery = buildDelivery(order, result);
  console.log(JSON.stringify(delivery, null, 2));
}

function createLicenseForOrder(store: LicenseStore, order: CrooOrder) {
  return store.create({
    label: licenseLabelForOrder(order),
    sourceOrderId: order.id,
  });
}

function licenseLabelForOrder(order: CrooOrder): string {
  return order.input.topic?.trim() || order.input.context?.trim() || `croo-order-${order.id}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startCrooProvider().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

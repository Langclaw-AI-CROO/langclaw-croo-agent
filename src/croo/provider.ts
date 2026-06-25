import "dotenv/config";

import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";
import { buildCapabilities, buildDelivery, buildLicenseDelivery, formatLicenseDeliveryText, type CrooCapabilityId, type CrooOrder } from "./delivery.js";
import { appendCrooOrderEvidence, evidenceForDelivery, evidenceForOrder } from "./evidence.js";
import { redactSecrets, redactUnknown as redactUnknownValue } from "../core/redact.js";
import { runCrooResearchAgent } from "../core/run-research.js";
import type { AgentTargetUse, ResearchDepth, ResearchMode, ResponseLanguage } from "../core/types.js";
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
  await reconcilePendingNegotiations(client, negotiationInputs);

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
    let chainOrder: Awaited<ReturnType<typeof client.getOrder>> | undefined;
    let order: CrooOrder | undefined;
    try {
      chainOrder = await client.getOrder(event.order_id);
      const stored = negotiationInputs.get(chainOrder.negotiationId);
      order = stored ?? normalizeOrder(await client.getNegotiation(chainOrder.negotiationId));
      order.id = chainOrder.orderId;
      await recordCrooOrderEvidence(
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
        await recordCrooOrderEvidence(
          evidenceForOrder("order_delivered", order, {
            negotiationId: chainOrder.negotiationId,
            orderId: chainOrder.orderId,
          })
        );
        return;
      }
      const delivery = buildDelivery(order, await runCrooResearchAgent(order.input));
      await client.deliverOrder(chainOrder.orderId, {
        deliverableType: DeliverableType.Schema,
        deliverableSchema: JSON.stringify(delivery),
      });
      await recordCrooOrderEvidence(
        evidenceForDelivery(order, delivery, {
          negotiationId: chainOrder.negotiationId,
          orderId: chainOrder.orderId,
        })
      );
    } catch (error) {
      if (order) {
        await recordCrooOrderEvidence(
          evidenceForOrder("order_failed", order, {
            negotiationId: chainOrder?.negotiationId,
            orderId: chainOrder?.orderId ?? event.order_id,
            error: errorMessage(error),
          })
        );
      }
      console.error("Failed to process paid CROO order.", errorMessage(error));
    }
  });

  process.on("SIGINT", () => {
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
    console.error("Failed to reconcile pending CROO negotiations.", errorMessage(error));
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
          error: errorMessage(error),
        })
      );
    }
    console.error("Failed to process CROO negotiation.", errorMessage(error));
  }
}

async function recordCrooOrderEvidence(evidence: Parameters<typeof appendCrooOrderEvidence>[0]): Promise<void> {
  try {
    await appendCrooOrderEvidence(evidence);
  } catch (error) {
    console.warn("Failed to write CROO order evidence.", error instanceof Error ? error.message : error);
  }
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
      topic: String((input as UnknownRecord).topic ?? (input as UnknownRecord).query ?? ""),
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

import "dotenv/config";

import { AgentClient, DeliverableType, EventType } from "@croo-network/sdk";
import { buildCapabilities, buildDelivery, buildLicenseDelivery, formatLicenseDeliveryText, type CrooCapabilityId, type CrooOrder } from "./delivery.js";
import { runCrooResearchAgent } from "../core/run-research.js";
import type { ResearchDepth, ResearchMode, ResponseLanguage } from "../core/types.js";
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

  stream.on(EventType.NegotiationCreated, async (event) => {
    if (!event.negotiation_id) {
      return;
    }
    const negotiation = await client.getNegotiation(event.negotiation_id);
    negotiationInputs.set(event.negotiation_id, normalizeOrder(negotiation));
    await acceptNegotiationForSettlement(client, event.negotiation_id, negotiation);
  });

  stream.on(EventType.OrderPaid, async (event) => {
    if (!event.order_id) {
      return;
    }
    const chainOrder = await client.getOrder(event.order_id);
    const stored = negotiationInputs.get(chainOrder.negotiationId);
    const order = stored ?? normalizeOrder(await client.getNegotiation(chainOrder.negotiationId));
    order.id = chainOrder.orderId;
    if (isLicenseOrder(order)) {
      const delivery = buildLicenseDelivery(order.id, createLicenseForOrder(licenseStore, order));
      await client.deliverOrder(chainOrder.orderId, {
        deliverableType: DeliverableType.Text,
        deliverableText: formatLicenseDeliveryText(delivery),
      });
      return;
    }
    const delivery = buildDelivery(order, await runCrooResearchAgent(order.input));
    await client.deliverOrder(chainOrder.orderId, {
      deliverableType: DeliverableType.Text,
      deliverableText: JSON.stringify(delivery),
    });
  });

  process.on("SIGINT", () => {
    stream.close();
    process.exit(0);
  });
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
  if (typeof value === "string") {
    return redactSecret(value);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return JSON.parse(redactSecret(JSON.stringify(value))) as unknown;
}

function redactSecret(value: string): string {
  return value.replace(/croo_sk_[A-Za-z0-9]+/g, "croo_sk_[redacted]");
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
  return Boolean(negotiation.fundAmount || negotiation.fundToken);
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
  return undefined;
}

function isLicenseOrder(order: CrooOrder): boolean {
  return order.capabilityId === "langclaw.builder.pass.license" || order.serviceId === licenseServiceId();
}

function licenseServiceId(): string {
  return process.env.LANGCLAW_LICENSE_SERVICE_ID?.trim() || "70b7b5d4-961b-47ba-97c6-a863b1c949c0";
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

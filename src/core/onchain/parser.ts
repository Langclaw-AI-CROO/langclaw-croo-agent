import { detectChain, detectUnsupportedChain } from "./chains.js";
import type { OnchainEntity, OnchainInput, OnchainIntent, OnchainScope } from "./types.js";

const evmAddressPattern = /\b0x[a-fA-F0-9]{40}\b/g;
const txHashPattern = /\b0x[a-fA-F0-9]{64}\b/g;

export function parseOnchainIntent(input: OnchainInput): OnchainIntent {
  const query = input.query.trim();
  if (!query) {
    throw new Error("query is required");
  }

  const chain = detectChain(`${query} ${input.chain ?? ""}`, input.chain);
  const unsupportedChain = detectUnsupportedChain(query);
  const addresses = extractAddresses(query);
  const transactionHashes = extractTransactionHashes(query);
  const scope = input.scope ?? classifyScope(query, input, transactionHashes, addresses);
  const metrics = extractMetrics(query, scope);
  const entities = extractEntities(input, query, scope, addresses, transactionHashes, chain.name);
  const confidence = scoreConfidence(scope, entities, unsupportedChain);

  return {
    originalQuery: query,
    rewrittenQuery: rewriteQuery(query, scope, chain.name, input.timeframe),
    scope,
    entities,
    metrics,
    timeframe: input.timeframe ?? extractTimeframe(query),
    chain,
    unsupportedChain,
    confidence,
    debug: {
      selectedScope: scope,
      scopeReason: scopeReason(scope, input, query),
      extractedAddresses: addresses,
      preservationCheck: scope === "unknown" ? "needs-review" : "preserved",
    },
  };
}

function classifyScope(
  query: string,
  input: OnchainInput,
  transactionHashes: string[],
  addresses: string[]
): OnchainScope {
  const text = query.toLowerCase();

  if (input.transactionHash || transactionHashes.length) {
    return "transaction";
  }
  if (input.walletAddress || /\b(wallet|portfolio|balance|holdings|pnl|account)\b/.test(text)) {
    return "wallet";
  }
  if (input.contractAddress || /\b(bytecode|abi|contract|proxy|owner|verified source)\b/.test(text)) {
    return "contract";
  }
  if (/\b(bridge|route|inflow|outflow|cross-chain|cross chain)\b/.test(text)) {
    return "bridge";
  }
  if (/\b(governance|proposal|vote|delegate|treasury)\b/.test(text)) {
    return "governance";
  }
  if (/\b(chain|network|gas|fees|blocks|transactions|active addresses|activity|stablecoin)\b/.test(text)) {
    return "chain";
  }
  if (/\b(tvl|protocol|revenue|fees|yield|apy|lending|dex)\b/.test(text)) {
    return "protocol";
  }
  if (input.tokenAddress || /\b(smart[-\s]?money|whale|accumulat|buy flow|sell flow|dex flow|net flow|netflow|large flow|token|price|holder|liquidity|pool|pair|volume|market cap|fdv|risk|honeypot|tax)\b/.test(text)) {
    return "token";
  }
  if (addresses.length) {
    return "contract";
  }
  return "unknown";
}

function extractMetrics(query: string, scope: OnchainScope): string[] {
  const text = query.toLowerCase();
  const metrics = new Set<string>();

  for (const [keyword, metric] of [
    ["tvl", "tvl"],
    ["liquidity", "liquidity"],
    ["volume", "volume"],
    ["price", "price"],
    ["holder", "holders"],
    ["smart", "smart-money"],
    ["whale", "smart-money"],
    ["accumulat", "accumulation"],
    ["buy flow", "buy-flow"],
    ["sell flow", "sell-flow"],
    ["netflow", "netflow"],
    ["balance", "balance"],
    ["transfer", "transfers"],
    ["transaction", "transactions"],
    ["risk", "risk"],
    ["yield", "yield"],
    ["apy", "yield"],
    ["gas", "gas"],
    ["fees", "fees"],
  ] as const) {
    if (text.includes(keyword)) {
      metrics.add(metric);
    }
  }

  if (!metrics.size) {
    metrics.add(scope === "unknown" ? "general" : scope);
  }

  return Array.from(metrics);
}

function extractEntities(
  input: OnchainInput,
  query: string,
  scope: OnchainScope,
  addresses: string[],
  transactionHashes: string[],
  chainName: string
): OnchainEntity[] {
  const entities: OnchainEntity[] = [
    { type: "chain", value: chainName, confidence: 0.9 },
  ];

  if (input.tokenAddress) {
    entities.push({ type: "token", value: input.tokenAddress, confidence: 0.95 });
  }
  if (input.walletAddress) {
    entities.push({ type: "wallet", value: input.walletAddress, confidence: 0.95 });
  }
  if (input.contractAddress) {
    entities.push({ type: "contract", value: input.contractAddress, confidence: 0.95 });
  }
  if (input.transactionHash) {
    entities.push({ type: "transaction", value: input.transactionHash, confidence: 0.95 });
  }

  for (const tx of transactionHashes) {
    entities.push({ type: "transaction", value: tx, confidence: 0.9 });
  }

  for (const address of addresses) {
    if (entities.some((entity) => entity.value.toLowerCase() === address.toLowerCase())) {
      continue;
    }
    entities.push({
      type: scope === "wallet" ? "wallet" : scope === "token" ? "token" : "contract",
      value: address,
      confidence: 0.75,
    });
  }

  const protocol = extractProtocolCandidate(query);
  if (protocol && ["protocol", "governance", "bridge"].includes(scope)) {
    entities.push({ type: scope === "governance" ? "governance" : "protocol", value: protocol, confidence: 0.65 });
  }

  return entities;
}

function rewriteQuery(query: string, scope: OnchainScope, chainName: string, timeframe?: string): string {
  const suffix = timeframe ? ` for ${timeframe}` : "";
  return `Get ${scope} analytics for ${query} on ${chainName}${suffix}.`;
}

function extractAddresses(query: string): string[] {
  return Array.from(query.matchAll(evmAddressPattern)).map((match) => match[0]);
}

function extractTransactionHashes(query: string): string[] {
  return Array.from(query.matchAll(txHashPattern)).map((match) => match[0]);
}

function extractTimeframe(query: string): string | undefined {
  const match = query.match(/\b(today|yesterday|last\s+7\s+days|last\s+30\s+days|this\s+week|this\s+month)\b/i);
  return match?.[0];
}

function extractProtocolCandidate(query: string): string | undefined {
  const match = query.match(/\b(?:protocol|for|on)\s+([a-z0-9-]{2,40})\b/i);
  return match?.[1]?.toLowerCase();
}

function scoreConfidence(
  scope: OnchainScope,
  entities: OnchainEntity[],
  unsupportedChain: { id: string; name: string } | undefined
) {
  if (unsupportedChain) {
    return 0.35;
  }
  if (scope === "unknown") {
    return 0.3;
  }
  return entities.length > 1 ? 0.82 : 0.7;
}

function scopeReason(scope: OnchainScope, input: OnchainInput, query: string): string {
  if (input.scope) {
    return "User supplied an explicit scope.";
  }
  return `Classified from query keywords as ${scope}.`;
}

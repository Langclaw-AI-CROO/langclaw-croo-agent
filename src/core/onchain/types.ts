export type OnchainScope =
  | "chain"
  | "token"
  | "protocol"
  | "wallet"
  | "contract"
  | "transaction"
  | "bridge"
  | "governance"
  | "unknown";

export type OnchainProvider =
  | "alchemy"
  | "coingecko"
  | "defillama"
  | "dexscreener"
  | "dune"
  | "etherscan"
  | "geckoterminal"
  | "goplus"
  | "local";

export type OnchainStatus = "success" | "failed" | "skipped";

export type OnchainEntity = {
  type: "chain" | "token" | "protocol" | "wallet" | "contract" | "transaction" | "bridge" | "governance";
  value: string;
  confidence: number;
};

export type OnchainInput = {
  query: string;
  chain?: string;
  scope?: OnchainScope;
  toolHints?: OnchainCommandId[];
  tokenAddress?: string;
  walletAddress?: string;
  contractAddress?: string;
  transactionHash?: string;
  timeframe?: string;
  responseLanguage?: "en" | "id";
};

export type ChainConfig = {
  aliases: string[];
  alchemyNetwork?: string;
  chainId?: number;
  dexscreenerId: string;
  etherscanId?: number;
  geckoterminalId: string;
  goplusId?: number;
  id: string;
  name: string;
  nativeSymbol: string;
};

export type OnchainIntent = {
  originalQuery: string;
  rewrittenQuery: string;
  scope: OnchainScope;
  entities: OnchainEntity[];
  metrics: string[];
  timeframe?: string;
  chain: ChainConfig;
  unsupportedChain?: { id: string; name: string };
  confidence: number;
  debug: {
    selectedScope: OnchainScope;
    scopeReason: string;
    extractedAddresses: string[];
    preservationCheck: "preserved" | "needs-review";
  };
};

export type OnchainCommandId =
  | "defillama.chain_tvl"
  | "defillama.protocols"
  | "defillama.protocol"
  | "defillama.yield_pools"
  | "defillama.stablecoins"
  | "dexscreener.search_pairs"
  | "dexscreener.token_pairs"
  | "dexscreener.token_snapshot"
  | "dexscreener.latest_profiles"
  | "dexscreener.latest_boosts"
  | "dexscreener.top_boosts"
  | "geckoterminal.trending_pools"
  | "geckoterminal.new_pools"
  | "geckoterminal.token_data"
  | "geckoterminal.token_holders"
  | "coingecko.market_context"
  | "etherscan.native_balance"
  | "etherscan.tx_list"
  | "etherscan.token_transfers"
  | "etherscan.contract_code"
  | "alchemy.token_balances"
  | "alchemy.asset_transfers"
  | "alchemy.token_metadata"
  | "goplus.token_security"
  | "goplus.address_security"
  | "dune.latest_result"
  | "dune.sql_execute"
  | "local.synthesis";

export type OnchainCommand = {
  id: OnchainCommandId;
  title: string;
  description: string;
  provider: OnchainProvider;
  scopes: OnchainScope[];
  required?: Array<"query" | "tokenAddress" | "walletAddress" | "contractAddress" | "transactionHash" | "duneQueryId">;
  cacheTtlSeconds: number;
  docsUrl?: string;
};

export type OnchainPlan = {
  intent: OnchainIntent;
  selectedRoute: OnchainScope;
  commands: OnchainCommand[];
  fallbackPolicy: string[];
  blockedFallbacks: string[];
  providerGaps: string[];
  debug: {
    commandCount: number;
    rejectedCommands: string[];
    finalStatus: "planned" | "unsupported" | "no-route";
  };
};

export type OnchainToolResult = {
  commandId: OnchainCommandId;
  title: string;
  provider: OnchainProvider;
  status: OnchainStatus;
  latencyMs: number;
  summary: string;
  sourceUrl?: string;
  data?: unknown;
  routeDebug?: Record<string, unknown>;
  error?: string;
};

export type RiskFlag = {
  level: "info" | "watch" | "high";
  label: string;
  detail: string;
};

export type OnchainOutput = {
  title: string;
  answer: string;
  bullets: string[];
  recommendation: string;
  caveat: string;
  generatedAt: string;
  confidence: "high" | "medium" | "low";
  riskFlags: RiskFlag[];
  plan: OnchainPlan;
  tools: OnchainToolResult[];
  providerTrace: Array<{
    provider: OnchainProvider;
    status: OnchainStatus;
    message: string;
    sourceUrl?: string;
    routeDebug?: Record<string, unknown>;
  }>;
  sourceUrls: string[];
  markdown: string;
  semantic?: OnchainSemanticResult;
};

export type OnchainSemanticResult = {
  summary: string;
  keyFindings: Array<{
    finding: string;
    confidence: "high" | "medium" | "low";
    whyItMatters: string;
    evidenceIds: string[];
  }>;
  signals: Array<{
    name: string;
    category: string;
    strength: "high" | "medium" | "low";
    description: string;
  }>;
  risks: Array<{
    risk: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  }>;
  opportunities: Array<{
    opportunity: string;
    targetUse: import("../types.js").AgentTargetUse;
  }>;
  agentReuse: {
    recommendedUses: import("../types.js").AgentTargetUse[];
    contentAngles: string[];
    decisionInputs: string[];
  };
  limitations: string[];
};

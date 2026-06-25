import type { ChainConfig, OnchainCommandId, SmartMoneyFlow } from "./types.js";

export type ProviderRequest = {
  chain: ChainConfig;
  query?: string;
  tokenAddress?: string;
  walletAddress?: string;
  contractAddress?: string;
  transactionHash?: string;
  signal?: AbortSignal;
  previousSummaries: string[];
};

export type ProviderResponse = {
  data: unknown;
  routeDebug?: Record<string, unknown>;
  summary: string;
  sourceUrl?: string;
};

export type ProviderExecutor = (request: ProviderRequest) => Promise<ProviderResponse>;

type DuneFetchResult = {
  attemptCount: number;
  data: unknown;
  fallbackUsed: boolean;
  key: string;
};

export const providerExecutors: Record<OnchainCommandId, ProviderExecutor> = {
  "defillama.chain_tvl": getDefiLlamaChains,
  "defillama.protocols": getDefiLlamaProtocols,
  "defillama.protocol": getDefiLlamaProtocol,
  "defillama.yield_pools": getDefiLlamaYieldPools,
  "defillama.stablecoins": getDefiLlamaStablecoins,
  "dexscreener.search_pairs": searchDexPairs,
  "dexscreener.token_pairs": getDexTokenPairs,
  "dexscreener.token_snapshot": getDexTokenSnapshot,
  "dexscreener.latest_profiles": getDexLatestProfiles,
  "dexscreener.latest_boosts": getDexLatestBoosts,
  "dexscreener.top_boosts": getDexTopBoosts,
  "geckoterminal.trending_pools": getGeckoTrendingPools,
  "geckoterminal.new_pools": getGeckoNewPools,
  "geckoterminal.token_data": getGeckoTokenData,
  "geckoterminal.token_holders": getGeckoTokenHolders,
  "coingecko.market_context": getCoinGeckoMarketContext,
  "etherscan.native_balance": getEtherscanNativeBalance,
  "etherscan.tx_list": getEtherscanTxList,
  "etherscan.token_transfers": getEtherscanTokenTransfers,
  "etherscan.contract_code": getEtherscanContractCode,
  "alchemy.token_balances": getAlchemyTokenBalances,
  "alchemy.asset_transfers": getAlchemyAssetTransfers,
  "alchemy.token_metadata": getAlchemyTokenMetadata,
  "goplus.token_security": getGoPlusTokenSecurity,
  "goplus.address_security": getGoPlusAddressSecurity,
  "dune.latest_result": getDuneLatestResult,
  "dune.sql_execute": executeDuneSmartMoneySql,
  "local.synthesis": localSynthesis,
};

async function getDefiLlamaChains(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://api.llama.fi/v2/chains";
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeArray(data, "chain TVL records") };
}

async function getDefiLlamaProtocols(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://api.llama.fi/protocols";
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeArray(data, "protocol records") };
}

async function getDefiLlamaProtocol(request: ProviderRequest): Promise<ProviderResponse> {
  const slug = normalizeSlug(request.query);
  if (!slug) {
    throw new Error("Protocol slug is required.");
  }
  const sourceUrl = `https://api.llama.fi/protocol/${encodeURIComponent(slug)}`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: `Fetched protocol TVL detail for ${slug}.` };
}

async function getDefiLlamaYieldPools(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://yields.llama.fi/pools";
  const data = await fetchJson(sourceUrl, request.signal);
  const rows = readDataRows(data).filter((row) =>
    String(row.chain ?? "").toLowerCase().includes(request.chain.name.toLowerCase())
  );
  return {
    data: rows.length ? { data: rows.slice(0, 20) } : data,
    sourceUrl,
    summary: rows.length
      ? `Fetched ${rows.length} yield pools matching ${request.chain.name}.`
      : "Fetched yield pools with no exact chain filter match.",
  };
}

async function getDefiLlamaStablecoins(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://stablecoins.llama.fi/stablecoins?includePrices=true";
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: "Fetched stablecoin supply data." };
}

async function searchDexPairs(request: ProviderRequest): Promise<ProviderResponse> {
  const query = requireQuery(request.query);
  const url = new URL("https://api.dexscreener.com/latest/dex/search");
  url.searchParams.set("q", query);
  const sourceUrl = url.toString();
  const data = filterDexPairs(await fetchJson(sourceUrl, request.signal), request.chain.dexscreenerId);
  return { data, sourceUrl, summary: summarizePairs(data, request.chain.name) };
}

async function getDexTokenPairs(request: ProviderRequest): Promise<ProviderResponse> {
  const tokenAddress = requireAddress(request.tokenAddress, "tokenAddress");
  const sourceUrl = `https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(request.chain.dexscreenerId)}/${encodeURIComponent(tokenAddress)}`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizePairs(data, request.chain.name) };
}

async function getDexTokenSnapshot(request: ProviderRequest): Promise<ProviderResponse> {
  const tokenAddress = requireAddress(request.tokenAddress, "tokenAddress");
  const sourceUrl = `https://api.dexscreener.com/tokens/v1/${encodeURIComponent(request.chain.dexscreenerId)}/${encodeURIComponent(tokenAddress)}`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizePairs(data, request.chain.name) };
}

async function getDexLatestProfiles(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://api.dexscreener.com/token-profiles/latest/v1";
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeArray(data, "latest token profile records") };
}

async function getDexLatestBoosts(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://api.dexscreener.com/token-boosts/latest/v1";
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeArray(data, "latest boost records") };
}

async function getDexTopBoosts(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = "https://api.dexscreener.com/token-boosts/top/v1";
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeArray(data, "top boost records") };
}

async function getGeckoTrendingPools(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(request.chain.geckoterminalId)}/trending_pools`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeGeckoRows(data, "trending pools") };
}

async function getGeckoNewPools(request: ProviderRequest): Promise<ProviderResponse> {
  const sourceUrl = `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(request.chain.geckoterminalId)}/new_pools`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeGeckoRows(data, "new pools") };
}

async function getGeckoTokenData(request: ProviderRequest): Promise<ProviderResponse> {
  const tokenAddress = requireAddress(request.tokenAddress, "tokenAddress");
  const sourceUrl = `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(request.chain.geckoterminalId)}/tokens/${encodeURIComponent(tokenAddress)}`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: "Fetched token pool data." };
}

async function getGeckoTokenHolders(request: ProviderRequest): Promise<ProviderResponse> {
  const tokenAddress = requireAddress(request.tokenAddress, "tokenAddress");
  const sourceUrl = `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(request.chain.geckoterminalId)}/tokens/${encodeURIComponent(tokenAddress)}/holders`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: summarizeGeckoRows(data, "holder records") };
}

async function getCoinGeckoMarketContext(request: ProviderRequest): Promise<ProviderResponse> {
  const query = requireQuery(request.query);
  const sourceUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
  const data = await fetchJson(sourceUrl, request.signal);
  return { data, sourceUrl, summary: "Fetched market search context." };
}

async function getEtherscanNativeBalance(request: ProviderRequest): Promise<ProviderResponse> {
  const wallet = requireAddress(request.walletAddress, "walletAddress");
  const url = etherscanUrl(request, { module: "account", action: "balance", address: wallet, tag: "latest" });
  const data = await fetchJson(url, request.signal);
  return { data, sourceUrl: url, summary: "Fetched native balance." };
}

async function getEtherscanTxList(request: ProviderRequest): Promise<ProviderResponse> {
  const wallet = requireAddress(request.walletAddress, "walletAddress");
  const url = etherscanUrl(request, { module: "account", action: "txlist", address: wallet, page: "1", offset: "20", sort: "desc" });
  const data = await fetchJson(url, request.signal);
  return { data, sourceUrl: url, summary: "Fetched account transaction list." };
}

async function getEtherscanTokenTransfers(request: ProviderRequest): Promise<ProviderResponse> {
  const address = request.walletAddress ?? request.tokenAddress;
  if (!address) {
    throw new Error("walletAddress or tokenAddress is required.");
  }
  const url = etherscanUrl(request, { module: "account", action: "tokentx", address, page: "1", offset: "20", sort: "desc" });
  const data = await fetchJson(url, request.signal);
  return { data, sourceUrl: url, summary: "Fetched token transfer list." };
}

async function getEtherscanContractCode(request: ProviderRequest): Promise<ProviderResponse> {
  const contract = requireAddress(request.contractAddress ?? request.tokenAddress, "contractAddress");
  const url = etherscanUrl(request, { module: "proxy", action: "eth_getCode", address: contract, tag: "latest" });
  const data = await fetchJson(url, request.signal);
  return { data, sourceUrl: url, summary: "Fetched contract bytecode." };
}

async function getAlchemyTokenBalances(request: ProviderRequest): Promise<ProviderResponse> {
  const wallet = requireAddress(request.walletAddress, "walletAddress");
  return alchemyRpc(request, "alchemy_getTokenBalances", [wallet]);
}

async function getAlchemyAssetTransfers(request: ProviderRequest): Promise<ProviderResponse> {
  const wallet = requireAddress(request.walletAddress, "walletAddress");
  return alchemyRpc(request, "alchemy_getAssetTransfers", [{ fromBlock: "0x0", toBlock: "latest", fromAddress: wallet, maxCount: "0x14", category: ["external", "erc20"] }]);
}

async function getAlchemyTokenMetadata(request: ProviderRequest): Promise<ProviderResponse> {
  const token = requireAddress(request.tokenAddress ?? request.contractAddress, "tokenAddress");
  return alchemyRpc(request, "alchemy_getTokenMetadata", [token]);
}

async function getGoPlusTokenSecurity(request: ProviderRequest): Promise<ProviderResponse> {
  const token = requireAddress(request.tokenAddress, "tokenAddress");
  const sourceUrl = `https://api.gopluslabs.io/api/v1/token_security/${request.chain.goplusId}?contract_addresses=${encodeURIComponent(token)}`;
  const data = await fetchJson(sourceUrl, request.signal, goPlusHeaders());
  return { data, sourceUrl, summary: "Fetched token risk flags." };
}

async function getGoPlusAddressSecurity(request: ProviderRequest): Promise<ProviderResponse> {
  const wallet = requireAddress(request.walletAddress, "walletAddress");
  const sourceUrl = `https://api.gopluslabs.io/api/v1/address_security/${encodeURIComponent(wallet)}?chain_id=${request.chain.goplusId}`;
  const data = await fetchJson(sourceUrl, request.signal, goPlusHeaders());
  return { data, sourceUrl, summary: "Fetched address risk flags." };
}

async function getDuneLatestResult(request: ProviderRequest): Promise<ProviderResponse> {
  const queryId = process.env.DUNE_DEFAULT_QUERY_ID;
  if (!queryId) {
    throw new Error("DUNE_DEFAULT_QUERY_ID is required.");
  }
  const sourceUrl = `https://api.dune.com/api/v1/query/${encodeURIComponent(queryId)}/results`;
  const result = await duneFetchUrl(sourceUrl, { signal: request.signal });
  return {
    data: result.data,
    routeDebug: {
      duneKeyAttemptCount: result.attemptCount,
      duneKeyFallbackUsed: result.fallbackUsed,
      executionProvider: "dune-rest",
    },
    sourceUrl,
    summary: "Fetched latest saved analytics result.",
  };
}

export function buildDuneSmartMoneySql(request: {
  chainId: string;
  query?: string;
  tokenAddress?: string;
}): {
  minUsd: number;
  route: "dune.sql_execute.dex_accumulation";
  selectedChain: string;
  sql: string;
  tableFamily: "dex.trades";
  tokenSymbol: string;
  windowDays: number;
} {
  const selectedChain = duneChainName(request.chainId);
  const windowDays = extractWindowDays(request.query);
  const minUsd = extractMinUsd(request.query);
  const tokenSymbol = extractTokenSymbol(request.query);
  const tokenAddress = request.tokenAddress?.trim().toLowerCase();
  const tokenFilter = tokenAddress
    ? `AND lower(token_bought_address) = '${escapeSqlLiteral(tokenAddress)}'`
    : tokenSymbol
      ? `AND upper(token_bought_symbol) = '${escapeSqlLiteral(tokenSymbol)}'`
      : "";
  const sql = `
WITH dex_buys AS (
  SELECT
    tx_from AS wallet,
    upper(token_bought_symbol) AS token_symbol,
    token_bought_address,
    amount_usd,
    block_time
  FROM dex.trades
  WHERE blockchain = '${escapeSqlLiteral(selectedChain)}'
    AND block_time >= date_add('day', -${windowDays}, current_timestamp)
    AND amount_usd IS NOT NULL
    AND amount_usd >= ${minUsd}
    AND token_bought_symbol IS NOT NULL
    ${tokenFilter}
),
grouped AS (
  SELECT
    wallet,
    token_symbol,
    token_bought_address,
    sum(amount_usd) AS net_usd,
    count(*) AS trades,
    min(block_time) AS first_seen,
    max(block_time) AS last_seen
  FROM dex_buys
  GROUP BY 1, 2, 3
  HAVING sum(amount_usd) >= ${minUsd}
)
SELECT
  wallet,
  token_symbol AS "tokenSymbol",
  token_bought_address AS "tokenAddress",
  round(net_usd, 2) AS "netUsd",
  trades,
  cast(cast(first_seen AS date) AS varchar) || ' to ' || cast(cast(last_seen AS date) AS varchar) AS "window",
  'dex_accumulation_candidate' AS "signal",
  'Dune dex.trades dynamic SQL' AS "dataSource"
FROM grouped
ORDER BY net_usd DESC
LIMIT 25`.trim();

  return {
    minUsd,
    route: "dune.sql_execute.dex_accumulation",
    selectedChain,
    sql,
    tableFamily: "dex.trades",
    tokenSymbol,
    windowDays,
  };
}

async function executeDuneSmartMoneySql(request: ProviderRequest): Promise<ProviderResponse> {
  const keys = readDuneApiKeys();
  if (!keys.length) {
    throw new Error("DUNE_API_KEY is required.");
  }

  const built = buildDuneSmartMoneySql({
    chainId: request.chain.id,
    query: request.query,
    tokenAddress: request.tokenAddress,
  });
  const executeResponse = await duneFetch("/sql/execute", {
    method: "POST",
    signal: request.signal,
    body: JSON.stringify({ sql: built.sql }),
  });
  const executionId = readExecutionId(executeResponse.data);
  const status = await pollDuneExecution(executionId, request.signal, executeResponse.key);
  const data = await duneFetch(`/execution/${encodeURIComponent(executionId)}/results`, {
    signal: request.signal,
    preferredKey: executeResponse.key,
  });
  const keyStats = summarizeDuneKeyStats([executeResponse, status, data]);

  return {
    data: data.data,
    routeDebug: {
      duneKeyAttemptCount: keyStats.attemptCount,
      duneKeyFallbackUsed: keyStats.fallbackUsed,
      executionId,
      generatedRoute: built.route,
      minUsd: built.minUsd,
      selectedChain: built.selectedChain,
      tableFamily: built.tableFamily,
      tokenSymbol: built.tokenSymbol || undefined,
      windowDays: built.windowDays,
      executionCostCredits: readRecord(status.data).execution_cost_credits,
    },
    sourceUrl: `https://api.dune.com/api/v1/execution/${encodeURIComponent(executionId)}/results`,
    summary: `Executed Dune dynamic SQL for ${built.selectedChain} DEX accumulation over ${built.windowDays} day(s) with minimum USD ${built.minUsd}.`,
  };
}

async function localSynthesis(request: ProviderRequest): Promise<ProviderResponse> {
  return {
    data: { summaries: request.previousSummaries },
    summary: `Synthesized ${request.previousSummaries.length} prior tool summaries.`,
  };
}

async function fetchJson(sourceUrl: string, signal?: AbortSignal, headers: Record<string, string> = {}) {
  const response = await fetch(sourceUrl, { headers, signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function duneFetch(
  path: string,
  init: { body?: string; method?: string; preferredKey?: string; signal?: AbortSignal } = {}
): Promise<DuneFetchResult> {
  return duneFetchUrl(`https://api.dune.com/api/v1${path}`, init);
}

async function duneFetchUrl(
  sourceUrl: string,
  init: { body?: string; method?: string; preferredKey?: string; signal?: AbortSignal } = {}
): Promise<DuneFetchResult> {
  const keys = orderDuneKeys(init.preferredKey);
  if (!keys.length) {
    throw new Error("DUNE_API_KEY is required.");
  }
  const maxAttempts = Math.min(readDuneMaxAttempts(), keys.length);
  let lastStatus = 0;
  for (let index = 0; index < maxAttempts; index += 1) {
    const key = keys[index];
    const response = await fetch(sourceUrl, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-dune-api-key": key,
      },
      signal: init.signal,
      body: init.body,
    });
    if (response.ok) {
      return {
        attemptCount: index + 1,
        data: await response.json(),
        fallbackUsed: index > 0,
        key,
      };
    }
    lastStatus = response.status;
    if (!shouldRetryDuneStatus(response.status) || index + 1 >= maxAttempts) {
      throw new Error(`Dune HTTP ${response.status}`);
    }
  }
  throw new Error(`Dune HTTP ${lastStatus || "unknown"}`);
}

export function readDuneApiKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  return uniqueStrings([env.DUNE_API_KEY, ...(env.DUNE_API_KEYS?.split(",") ?? [])]);
}

function orderDuneKeys(preferredKey?: string): string[] {
  const keys = readDuneApiKeys();
  if (!preferredKey) {
    return keys;
  }
  return uniqueStrings([preferredKey, ...keys]);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function shouldRetryDuneStatus(status: number): boolean {
  return readDuneRetryStatuses().has(status);
}

function readDuneRetryStatuses(): Set<number> {
  const raw = process.env.DUNE_API_KEY_RETRY_STATUS ?? "401,403,408,429,500,502,503,504";
  return new Set(
    raw
      .split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => Number.isInteger(item) && item > 0)
  );
}

function readDuneMaxAttempts(): number {
  const parsed = Number.parseInt(process.env.DUNE_API_KEY_MAX_ATTEMPTS ?? "2", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
}

function summarizeDuneKeyStats(results: DuneFetchResult[]): { attemptCount: number; fallbackUsed: boolean } {
  return {
    attemptCount: results.reduce((sum, result) => sum + result.attemptCount, 0),
    fallbackUsed: results.some((result) => result.fallbackUsed),
  };
}

async function alchemyRpc(request: ProviderRequest, method: string, params: unknown[]): Promise<ProviderResponse> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key || !request.chain.alchemyNetwork) {
    throw new Error("Alchemy is not configured for this chain.");
  }
  const sourceUrl = `https://${request.chain.alchemyNetwork}.g.alchemy.com/v2/${key}`;
  const response = await fetch(sourceUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: request.signal,
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return { data: await response.json(), sourceUrl, summary: `Fetched ${method}.` };
}

function etherscanUrl(request: ProviderRequest, params: Record<string, string>): string {
  if (!process.env.ETHERSCAN_API_KEY || !request.chain.etherscanId) {
    throw new Error("Etherscan is not configured for this chain.");
  }
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(request.chain.etherscanId));
  url.searchParams.set("apikey", process.env.ETHERSCAN_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function goPlusHeaders(): Record<string, string> {
  if (!process.env.GOPLUS_API_KEY) {
    return {};
  }
  return process.env.GOPLUS_API_SECRET
    ? { "x-api-key": process.env.GOPLUS_API_KEY, "x-api-secret": process.env.GOPLUS_API_SECRET }
    : { "x-api-key": process.env.GOPLUS_API_KEY };
}

function filterDexPairs(value: unknown, chainId: string): unknown {
  if (!value || typeof value !== "object" || !Array.isArray((value as { pairs?: unknown }).pairs)) {
    return value;
  }
  return {
    ...(value as Record<string, unknown>),
    pairs: (value as { pairs: Array<Record<string, unknown>> }).pairs.filter(
      (pair) => String(pair.chainId ?? "").toLowerCase() === chainId.toLowerCase()
    ),
  };
}

function readDataRows(value: unknown): Array<Record<string, unknown>> {
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: Array<Record<string, unknown>> }).data;
  }
  return [];
}

export function extractDuneSmartMoneyRows(value: unknown, limit = 10): SmartMoneyFlow[] {
  return readDuneRows(value)
    .map(normalizeDuneSmartMoneyRow)
    .filter((row): row is SmartMoneyFlow => Boolean(row))
    .slice(0, Math.max(0, limit));
}

function readDuneRows(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.rows)) {
    return records(record.rows);
  }
  if (Array.isArray(record.data)) {
    return records(record.data);
  }
  if (record.result && typeof record.result === "object") {
    const result = record.result as Record<string, unknown>;
    if (Array.isArray(result.rows)) {
      return records(result.rows);
    }
    if (Array.isArray(result.data)) {
      return records(result.data);
    }
  }
  if (record.data && typeof record.data === "object" && Array.isArray((record.data as { rows?: unknown }).rows)) {
    return records((record.data as { rows: unknown[] }).rows);
  }
  return [];
}

function normalizeDuneSmartMoneyRow(row: Record<string, unknown>): SmartMoneyFlow | undefined {
  const wallet = readString(row.wallet ?? row.tx_from ?? row.txFrom);
  if (!isEvmAddress(wallet)) {
    return undefined;
  }
  const tokenSymbol = readString(row.tokenSymbol ?? row.token_symbol ?? row.token_bought_symbol).toUpperCase() || "UNKNOWN";
  const tokenAddress = readString(row.tokenAddress ?? row.token_address ?? row.token_bought_address);
  const netUsd = readNumber(row.netUsd ?? row.net_usd ?? row.amountUsd ?? row.amount_usd);
  const trades = Math.max(0, Math.round(readNumber(row.trades ?? row.tradeCount ?? row.trade_count)));
  if (!Number.isFinite(netUsd) || netUsd <= 0) {
    return undefined;
  }
  return {
    dataSource: readString(row.dataSource ?? row.data_source) || "Dune dex.trades dynamic SQL",
    evidenceId: "",
    netUsd,
    signal: readString(row.signal) || "dex_accumulation_candidate",
    tokenAddress: isEvmAddress(tokenAddress) ? tokenAddress.toLowerCase() : undefined,
    tokenSymbol,
    trades,
    wallet: wallet.toLowerCase(),
    window: readString(row.window) || "",
  };
}

function records(value: unknown[]): Array<Record<string, unknown>> {
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function summarizeArray(value: unknown, label: string): string {
  return Array.isArray(value) ? `Fetched ${value.length} ${label}.` : `Fetched ${label}.`;
}

function summarizePairs(value: unknown, chainName: string): string {
  const pairs =
    value && typeof value === "object" && Array.isArray((value as { pairs?: unknown }).pairs)
      ? (value as { pairs: unknown[] }).pairs
      : Array.isArray(value)
        ? value
        : [];
  return pairs.length ? `Fetched ${pairs.length} pairs on ${chainName}.` : `No pairs returned for ${chainName}.`;
}

function summarizeGeckoRows(value: unknown, label: string): string {
  const rows = readDataRows(value);
  return rows.length ? `Fetched ${rows.length} ${label}.` : `Fetched ${label}.`;
}

function requireQuery(query: string | undefined): string {
  if (!query?.trim()) {
    throw new Error("query is required.");
  }
  return query.trim();
}

function requireAddress(address: string | undefined, label: string): string {
  if (!address?.trim()) {
    throw new Error(`${label} is required.`);
  }
  return address.trim();
}

function duneChainName(chainId: string): string {
  const allowed: Record<string, string> = {
    arbitrum: "arbitrum",
    avalanche: "avalanche_c",
    base: "base",
    bnb: "bnb",
    celo: "celo",
    ethereum: "ethereum",
    mantle: "mantle",
    optimism: "optimism",
    polygon: "polygon",
  };
  const chain = allowed[chainId];
  if (!chain) {
    throw new Error(`Dune dynamic SQL is not configured for ${chainId}.`);
  }
  return chain;
}

function extractWindowDays(query: string | undefined): number {
  const text = query ?? "";
  const raw =
    text.match(/\blast\s+(\d{1,2})\s+days?\b/i)?.[1] ??
    text.match(/\b(\d{1,2})d\b/i)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 7;
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 7, 1), 30);
}

function extractMinUsd(query: string | undefined): number {
  const text = query ?? "";
  const raw =
    text.match(/\bmin(?:imum)?\s+\$?(\d{3,12})\b/i)?.[1] ??
    text.match(/\$?(\d{3,12})\s*(?:usd|minimum|min)\b/i)?.[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 10000;
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10000, 100), 1000000);
}

function extractTokenSymbol(query: string | undefined): string {
  const raw =
    query?.match(/\$([a-zA-Z][a-zA-Z0-9]{1,19})\b/)?.[1] ??
    query?.match(/\b(?:token|for|of)\s+([A-Z][A-Z0-9]{1,19})\b/)?.[1];
  return raw?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''").replace(/[^a-zA-Z0-9_:.+-]/g, "");
}

async function pollDuneExecution(executionId: string, signal?: AbortSignal, preferredKey?: string): Promise<DuneFetchResult> {
  const intervalMs = Number.parseInt(process.env.DUNE_SQL_POLL_INTERVAL_MS ?? "1000", 10);
  const maxAttempts = Number.parseInt(process.env.DUNE_SQL_POLL_ATTEMPTS ?? "30", 10);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await duneFetch(`/execution/${encodeURIComponent(executionId)}/status`, { preferredKey, signal });
    const record = readRecord(status.data);
    if (record.is_execution_finished === true || record.state === "QUERY_STATE_COMPLETED") {
      return status;
    }
    if (record.state === "QUERY_STATE_FAILED" || record.state === "QUERY_STATE_CANCELLED") {
      throw new Error(`Dune execution failed: ${String(record.state)}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`Dune execution did not complete: ${executionId}`);
}

function readExecutionId(value: unknown): string {
  const record = readRecord(value);
  const id = record.execution_id ?? record.executionId;
  if (typeof id !== "string" || !id) {
    throw new Error("Dune did not return an execution id.");
  }
  return id;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSlug(query: string | undefined): string {
  const text = query?.trim().toLowerCase() ?? "";
  const match = text.match(/\b(?:protocol|for|on)\s+([a-z0-9-]{2,40})\b/i);
  return match?.[1] ?? (/^[a-z0-9-]{2,40}$/.test(text) ? text : "");
}

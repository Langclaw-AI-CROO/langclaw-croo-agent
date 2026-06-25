import type { OnchainCommand, OnchainCommandId, OnchainScope } from "./types.js";

export const onchainCommands: OnchainCommand[] = [
  command("defillama.chain_tvl", "Chain TVL", "Read chain TVL data.", "defillama", ["chain"], 300),
  command("defillama.protocols", "Protocol TVL list", "Read protocol TVL rankings.", "defillama", ["protocol"], 300),
  command("defillama.protocol", "Protocol TVL detail", "Read TVL detail for a named protocol.", "defillama", ["protocol", "governance", "bridge"], 300, ["query"]),
  command("defillama.yield_pools", "Yield pools", "Read yield pool data for the selected chain.", "defillama", ["protocol"], 300),
  command("defillama.stablecoins", "Stablecoin supply", "Read stablecoin supply data.", "defillama", ["chain", "protocol"], 300),
  command("dexscreener.search_pairs", "Pair search", "Search token and pair market data.", "dexscreener", ["token", "protocol", "bridge"], 30, ["query"]),
  command("dexscreener.token_pairs", "Token pairs", "Read liquidity pools for a token address.", "dexscreener", ["token"], 30, ["tokenAddress"]),
  command("dexscreener.token_snapshot", "Token market snapshot", "Read token price, volume, and liquidity.", "dexscreener", ["token"], 30, ["tokenAddress"]),
  command("dexscreener.latest_profiles", "Latest token profiles", "Read latest token profiles.", "dexscreener", ["token", "chain"], 30),
  command("dexscreener.latest_boosts", "Latest token boosts", "Read latest boosted tokens.", "dexscreener", ["token", "chain"], 30),
  command("dexscreener.top_boosts", "Top token boosts", "Read top boosted tokens.", "dexscreener", ["token", "chain"], 30),
  command("geckoterminal.trending_pools", "Trending pools", "Read trending pools for the selected chain.", "geckoterminal", ["chain", "token"], 60),
  command("geckoterminal.new_pools", "New pools", "Read newly created pools for the selected chain.", "geckoterminal", ["chain", "token"], 60),
  command("geckoterminal.token_data", "Token pool data", "Read token pool data by address.", "geckoterminal", ["token"], 60, ["tokenAddress"]),
  command("geckoterminal.token_holders", "Token holders", "Read token holder concentration data.", "geckoterminal", ["token"], 60, ["tokenAddress"]),
  command("coingecko.market_context", "Market context", "Read market context for a named asset.", "coingecko", ["token"], 120, ["query"]),
  command("etherscan.native_balance", "Native balance", "Read native account balance.", "etherscan", ["wallet"], 60, ["walletAddress"]),
  command("etherscan.tx_list", "Transaction list", "Read account transaction list.", "etherscan", ["wallet", "transaction"], 60, ["walletAddress"]),
  command("etherscan.token_transfers", "Token transfers", "Read token transfer history.", "etherscan", ["token", "wallet"], 60),
  command("etherscan.contract_code", "Contract bytecode", "Read contract bytecode.", "etherscan", ["contract"], 60, ["contractAddress"]),
  command("alchemy.token_balances", "Token balances", "Read token balances for a wallet.", "alchemy", ["wallet"], 60, ["walletAddress"]),
  command("alchemy.asset_transfers", "Asset transfers", "Read asset transfers for a wallet.", "alchemy", ["wallet"], 60, ["walletAddress"]),
  command("alchemy.token_metadata", "Token metadata", "Read token metadata by address.", "alchemy", ["token", "contract"], 60, ["tokenAddress"]),
  command("goplus.token_security", "Token risk check", "Read token security flags.", "goplus", ["token"], 120, ["tokenAddress"]),
  command("goplus.address_security", "Address risk check", "Read address risk flags.", "goplus", ["wallet"], 120, ["walletAddress"]),
  command("dune.sql_execute", "Dynamic Dune smart-money flow", "Execute safe generated Dune SQL for DEX accumulation and buy-flow analytics.", "dune", ["chain", "token", "wallet"], 300, ["query"]),
  command("dune.latest_result", "Saved analytics query", "Read latest result from a configured analytics query.", "dune", ["chain", "token", "protocol", "wallet"], 300, ["duneQueryId"]),
  command("local.synthesis", "Local synthesis", "Summarize the completed tool results.", "local", ["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"], 0),
];

export function getCommandsByScope(scope: OnchainScope): OnchainCommand[] {
  return onchainCommands.filter((command) => command.scopes.includes(scope));
}

export function getCommandById(id: OnchainCommandId): OnchainCommand {
  const match = onchainCommands.find((command) => command.id === id);
  if (!match) {
    throw new Error(`Unknown onchain command ${id}`);
  }
  return match;
}

function command(
  id: OnchainCommandId,
  title: string,
  description: string,
  provider: OnchainCommand["provider"],
  scopes: OnchainScope[],
  cacheTtlSeconds: number,
  required: OnchainCommand["required"] = []
): OnchainCommand {
  return {
    id,
    title,
    description,
    provider,
    scopes,
    required,
    cacheTtlSeconds,
    docsUrl: docsUrl(provider),
  };
}

function docsUrl(provider: OnchainCommand["provider"]): string | undefined {
  return {
    alchemy: "https://www.alchemy.com/docs/data",
    coingecko: "https://docs.coingecko.com/reference/introduction",
    defillama: "https://api-docs.defillama.com/",
    dexscreener: "https://docs.dexscreener.com/api/reference",
    dune: "https://docs.dune.com/api-reference/overview/introduction",
    etherscan: "https://docs.etherscan.io/",
    geckoterminal: "https://www.geckoterminal.com/dex-api",
    goplus: "https://docs.gopluslabs.io/",
    local: undefined,
  }[provider];
}

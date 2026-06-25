import type { ChainConfig } from "./types.js";

export const defaultOnchainChain = "base";

const chains: Record<string, ChainConfig> = {
  arbitrum: {
    aliases: ["arb", "arbitrum one"],
    alchemyNetwork: "arb-mainnet",
    chainId: 42161,
    dexscreenerId: "arbitrum",
    etherscanId: 42161,
    geckoterminalId: "arbitrum",
    goplusId: 42161,
    id: "arbitrum",
    name: "Arbitrum",
    nativeSymbol: "ETH",
  },
  avalanche: {
    aliases: ["avax", "avalanche c-chain"],
    alchemyNetwork: "avax-mainnet",
    chainId: 43114,
    dexscreenerId: "avalanche",
    etherscanId: 43114,
    geckoterminalId: "avax",
    goplusId: 43114,
    id: "avalanche",
    name: "Avalanche",
    nativeSymbol: "AVAX",
  },
  base: {
    aliases: ["base mainnet"],
    alchemyNetwork: "base-mainnet",
    chainId: 8453,
    dexscreenerId: "base",
    etherscanId: 8453,
    geckoterminalId: "base",
    goplusId: 8453,
    id: "base",
    name: "Base",
    nativeSymbol: "ETH",
  },
  bnb: {
    aliases: ["bsc", "binance smart chain"],
    chainId: 56,
    dexscreenerId: "bsc",
    etherscanId: 56,
    geckoterminalId: "bsc",
    goplusId: 56,
    id: "bnb",
    name: "BNB Smart Chain",
    nativeSymbol: "BNB",
  },
  celo: {
    aliases: ["celo mainnet", "celo network", "minipay"],
    alchemyNetwork: "celo-mainnet",
    chainId: 42220,
    dexscreenerId: "celo",
    etherscanId: 42220,
    geckoterminalId: "celo",
    id: "celo",
    name: "Celo",
    nativeSymbol: "CELO",
  },
  ethereum: {
    aliases: ["eth", "mainnet"],
    alchemyNetwork: "eth-mainnet",
    chainId: 1,
    dexscreenerId: "ethereum",
    etherscanId: 1,
    geckoterminalId: "eth",
    goplusId: 1,
    id: "ethereum",
    name: "Ethereum",
    nativeSymbol: "ETH",
  },
  mantle: {
    aliases: ["mnt", "mantle mainnet", "mantle network"],
    chainId: 5000,
    dexscreenerId: "mantle",
    etherscanId: 5000,
    geckoterminalId: "mantle",
    goplusId: 5000,
    id: "mantle",
    name: "Mantle",
    nativeSymbol: "MNT",
  },
  optimism: {
    aliases: ["op", "optimistic ethereum"],
    alchemyNetwork: "opt-mainnet",
    chainId: 10,
    dexscreenerId: "optimism",
    etherscanId: 10,
    geckoterminalId: "optimism",
    goplusId: 10,
    id: "optimism",
    name: "Optimism",
    nativeSymbol: "ETH",
  },
  polygon: {
    aliases: ["matic", "polygon pos"],
    alchemyNetwork: "polygon-mainnet",
    chainId: 137,
    dexscreenerId: "polygon",
    etherscanId: 137,
    geckoterminalId: "polygon_pos",
    goplusId: 137,
    id: "polygon",
    name: "Polygon",
    nativeSymbol: "MATIC",
  },
  solana: {
    aliases: ["sol"],
    chainId: 501,
    dexscreenerId: "solana",
    geckoterminalId: "solana",
    goplusId: 501,
    id: "solana",
    name: "Solana",
    nativeSymbol: "SOL",
  },
};

const unsupportedNames: Record<string, string> = {
  aptos: "Aptos",
  berachain: "Berachain",
  monad: "Monad",
  near: "NEAR",
  sei: "Sei",
};

export function resolveChain(input: string | undefined): ChainConfig {
  const normalized = normalize(input) || defaultOnchainChain;

  for (const chain of Object.values(chains)) {
    if (chain.id === normalized || chain.aliases.map(normalize).includes(normalized)) {
      return chain;
    }
  }

  return chains[defaultOnchainChain];
}

export function detectChain(text: string, fallback?: string): ChainConfig {
  const normalized = text.toLowerCase();
  const candidates: Array<{ chain: ChainConfig; index: number; term: string }> = [];

  for (const chain of Object.values(chains)) {
    for (const term of [chain.id, chain.name, ...chain.aliases]) {
      const match = new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, "i").exec(normalized);
      if (match) {
        candidates.push({ chain, index: match.index, term });
      }
    }
  }

  candidates.sort((left, right) => {
    if (left.index !== right.index) {
      return left.index - right.index;
    }
    return right.term.length - left.term.length;
  });

  return candidates[0]?.chain ?? resolveChain(fallback);
}

export function detectUnsupportedChain(text: string): { id: string; name: string } | undefined {
  const normalized = text.toLowerCase();
  for (const [id, name] of Object.entries(unsupportedNames)) {
    if (new RegExp(`\\b${escapeRegExp(id)}\\b`, "i").test(normalized)) {
      return { id, name };
    }
  }
  return undefined;
}

export function supportsProvider(chain: ChainConfig, provider: string): boolean {
  if (provider === "alchemy") {
    return Boolean(chain.alchemyNetwork);
  }
  if (provider === "etherscan") {
    return Boolean(chain.etherscanId);
  }
  if (provider === "goplus") {
    return Boolean(chain.goplusId);
  }
  return true;
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(chains);
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

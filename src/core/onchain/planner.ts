import { supportsProvider } from "./chains.js";
import { getCommandsByScope, onchainCommands } from "./registry.js";
import type { OnchainCommand, OnchainInput, OnchainIntent, OnchainPlan } from "./types.js";

export function planOnchainTools(intent: OnchainIntent, input: OnchainInput): OnchainPlan {
  if (intent.unsupportedChain) {
    return {
      intent,
      selectedRoute: intent.scope,
      commands: [localSynthesis()],
      fallbackPolicy: [],
      blockedFallbacks: [`No same-scope provider route is configured for ${intent.unsupportedChain.name}.`],
      providerGaps: [`Unsupported chain requested: ${intent.unsupportedChain.name}.`],
      debug: {
        commandCount: 1,
        rejectedCommands: [],
        finalStatus: "unsupported",
      },
    };
  }

  const rejectedCommands: string[] = [];
  const providerGaps: string[] = [];
  const candidates = orderCandidates(getCommandsByScope(intent.scope), intent);
  const selected: OnchainCommand[] = [];

  for (const command of candidates) {
    if (!supportsProvider(intent.chain, command.provider)) {
      rejectedCommands.push(`${command.id}: provider does not support ${intent.chain.name}`);
      continue;
    }
    if (!hasRequiredInput(command, intent, input)) {
      rejectedCommands.push(`${command.id}: missing required input`);
      continue;
    }
    if (!hasProviderKey(command)) {
      providerGaps.push(`${command.provider} is not configured.`);
      rejectedCommands.push(`${command.id}: provider credentials not configured`);
      continue;
    }
    selected.push(command);
    if (selected.length >= 5) {
      break;
    }
  }

  if (!selected.some((command) => command.id === "local.synthesis")) {
    selected.push(localSynthesis());
  }

  return {
    intent,
    selectedRoute: intent.scope,
    commands: selected,
    fallbackPolicy: buildFallbackPolicy(intent.scope),
    blockedFallbacks: buildBlockedFallbacks(intent.scope),
    providerGaps: Array.from(new Set(providerGaps)),
    debug: {
      commandCount: selected.length,
      rejectedCommands,
      finalStatus: selected.length > 1 ? "planned" : "no-route",
    },
  };
}

function hasRequiredInput(command: OnchainCommand, intent: OnchainIntent, input: OnchainInput): boolean {
  const required = command.required ?? [];
  return required.every((field) => {
    if (field === "query") {
      return Boolean(intent.rewrittenQuery || input.query);
    }
    if (field === "tokenAddress") {
      return Boolean(input.tokenAddress || findEntity(intent, "token"));
    }
    if (field === "walletAddress") {
      return Boolean(input.walletAddress || findEntity(intent, "wallet"));
    }
    if (field === "contractAddress") {
      return Boolean(input.contractAddress || findEntity(intent, "contract"));
    }
    if (field === "transactionHash") {
      return Boolean(input.transactionHash || findEntity(intent, "transaction"));
    }
    if (field === "duneQueryId") {
      return Boolean(process.env.DUNE_DEFAULT_QUERY_ID);
    }
    return true;
  });
}

function hasProviderKey(command: OnchainCommand): boolean {
  if (command.provider === "alchemy") {
    return Boolean(process.env.ALCHEMY_API_KEY);
  }
  if (command.provider === "etherscan") {
    return Boolean(process.env.ETHERSCAN_API_KEY);
  }
  if (command.provider === "goplus") {
    return Boolean(process.env.GOPLUS_API_KEY);
  }
  if (command.provider === "dune") {
    return command.id === "dune.sql_execute"
      ? Boolean(process.env.DUNE_API_KEY)
      : Boolean(process.env.DUNE_API_KEY && process.env.DUNE_DEFAULT_QUERY_ID);
  }
  return true;
}

function findEntity(intent: OnchainIntent, type: string): string | undefined {
  return intent.entities.find((entity) => entity.type === type)?.value;
}

function localSynthesis(): OnchainCommand {
  return onchainCommands.find((command) => command.id === "local.synthesis") as OnchainCommand;
}

function orderCandidates(commands: OnchainCommand[], intent: OnchainIntent): OnchainCommand[] {
  if (!isDuneDynamicPrompt(intent)) {
    return commands;
  }
  return [...commands].sort((left, right) => {
    if (left.id === "dune.sql_execute") {
      return -1;
    }
    if (right.id === "dune.sql_execute") {
      return 1;
    }
    return 0;
  });
}

function isDuneDynamicPrompt(intent: OnchainIntent): boolean {
  const text = `${intent.originalQuery} ${intent.metrics.join(" ")}`.toLowerCase();
  return /\b(smart[-\s]?money|whale|accumulat|buy flow|sell flow|dex flow|net flow|netflow|large flow|holder flow)\b/.test(text);
}

function buildFallbackPolicy(scope: string): string[] {
  return [`Fallbacks must preserve ${scope} scope.`, "Adjacent data may be shown only as context."];
}

function buildBlockedFallbacks(scope: string): string[] {
  if (scope === "chain") {
    return ["Do not replace chain activity with token price data."];
  }
  if (scope === "protocol") {
    return ["Do not replace protocol TVL or usage with token-only market data."];
  }
  if (scope === "wallet") {
    return ["Do not replace wallet activity with public exchange data."];
  }
  if (scope === "contract") {
    return ["Do not replace bytecode or contract metadata with token profile data."];
  }
  return [`Do not change ${scope} scope during fallback.`];
}

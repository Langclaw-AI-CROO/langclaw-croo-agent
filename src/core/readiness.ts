export type ReadinessCheck = {
  name: string;
  status: "ready" | "missing" | "optional";
  message: string;
};

export function getReadiness(): { ready: boolean; checks: ReadinessCheck[] } {
  const checks: ReadinessCheck[] = [
    required("CROO_API_URL", "CROO API endpoint is configured."),
    required("CROO_WS_URL", "CROO websocket endpoint is configured."),
    requiredEither(["CROO_SDK_KEY", "CROO_API_KEY"], "CROO API key is configured."),
    requiredEither(["LANGCLAW_ADMIN_ACCESS_TOKENS", "LANGCLAW_ACCESS_TOKENS"], "Hosted MCP admin fallback tokens are configured."),
    optional("LANGCLAW_LICENSE_STORE_PATH", "License registry path is configured."),
    optional("LANGCLAW_LICENSE_DEFAULT_DAYS", "Default license duration is configured."),
    optional("LANGCLAW_LICENSE_DEFAULT_CALLS", "Default license call limit is configured."),
    optional("TAVILY_API_KEY", "Tavily source search can run."),
    optional("BRAVE_SEARCH_API_KEY", "Brave source search can run."),
    optional("GITHUB_TOKEN", "GitHub repository search can run."),
    optional("ETHERSCAN_API_KEY", "Etherscan account, transfer, and bytecode checks can run."),
    optional("ALCHEMY_API_KEY", "Alchemy balance, metadata, and transfer checks can run."),
    optional("GOPLUS_API_KEY", "GoPlus risk checks can run."),
    optional("DUNE_API_KEY", "Dune saved-query and dynamic SQL analytics can run."),
    optional("DUNE_API_KEYS", "Dune backup API keys are configured."),
    optional("DUNE_DEFAULT_QUERY_ID", "Dune default saved query is configured."),
    optional("OPENAI_API_KEY", "Onchain semantic reasoning can run when LANGCLAW_ONCHAIN_REASONING_ENABLED=true."),
    optional("LANGCLAW_ONCHAIN_REASONING_ENABLED", "Onchain semantic reasoning flag is configured."),
    optional("LANGCLAW_A2A_WORKBENCH_ENABLED", "Optional Universal Workbench A2A add-on flag is configured."),
    optional("LANGCLAW_A2A_WORKBENCH_SERVICE_ID", "Universal Workbench A2A service ID is configured."),
  ];

  return {
    ready: checks
      .filter((check) =>
        ["CROO_API_URL", "CROO_WS_URL", "CROO_SDK_KEY|CROO_API_KEY", "LANGCLAW_ADMIN_ACCESS_TOKENS|LANGCLAW_ACCESS_TOKENS"].includes(check.name)
      )
      .every((check) => check.status === "ready"),
    checks,
  };
}

function required(name: string, message: string): ReadinessCheck {
  return process.env[name]
    ? { name, status: "ready", message }
    : { name, status: "missing", message: `${name} is required for the live provider.` };
}

function optional(name: string, message: string): ReadinessCheck {
  return process.env[name]
    ? { name, status: "ready", message }
    : { name, status: "optional", message: `${name} is not set.` };
}

function requiredEither(names: string[], message: string): ReadinessCheck {
  return names.some((name) => process.env[name])
    ? { name: names.join("|"), status: "ready", message }
    : { name: names.join("|"), status: "missing", message: `${names.join(" or ")} is required for the live provider.` };
}

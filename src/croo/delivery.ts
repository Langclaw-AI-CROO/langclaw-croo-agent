import type { AgentTargetUse, ResearchInput, ResearchOutput } from "../core/types.js";
import type { SmartMoneyFlow, SmartMoneyInsight } from "../core/onchain/types.js";
import { stableHash } from "../core/hash.js";
import type { CreateLicenseResult } from "../license/types.js";
import type { A2AWorkPack } from "./a2a-workbench.js";

export type CrooCapabilityId = "langclaw.research.brief" | "langclaw.onchain.intelligence" | "langclaw.builder.pass.license";

export type CrooCapability = {
  id: CrooCapabilityId;
  name: string;
  description: string;
  priceUsdc: string;
  inputSchema: Record<string, unknown>;
};

export type CrooOrder = {
  id: string;
  capabilityId?: CrooCapabilityId;
  input: ResearchInput;
  serviceId?: string;
};

export type CrooDelivery = {
  orderId: string;
  capabilityId: CrooCapability["id"];
  status: "delivered";
  result: ResearchOutput;
  proof: {
    deliveryHash: string;
    generatedAt: string;
    inputHash: string;
    sourceCount: number;
  };
} | OnchainIntelligenceDelivery;

export type BuildDeliveryOptions = {
  a2aWorkPack?: A2AWorkPack;
};

export type OnchainIntelligenceDelivery = {
  type: "langclaw-onchain-intelligence";
  version: "1.0";
  orderId: string;
  capabilityId: "langclaw.onchain.intelligence";
  status: "delivered";
  request: {
    research_prompt: string;
    query: string;
    chain?: string;
    scope?: string;
    timeframe?: string;
    targetUse?: AgentTargetUse;
    responseLanguage?: "en" | "id";
  };
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
    targetUse: AgentTargetUse;
  }>;
  agentReuse: {
    recommendedUses: AgentTargetUse[];
    contentAngles: string[];
    decisionInputs: string[];
  };
  sources: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
    observedAt?: string;
  }>;
  onchainContext: {
    chain: string;
    addresses: string[];
    transactionHashes: string[];
    metrics: string[];
  };
  a2aWorkPack?: A2AWorkPack;
  smartMoney?: SmartMoneyInsight;
  limitations: string[];
  proof: {
    deliveryHash: string;
    inputHash: string;
    generatedAt: string;
    sourceCount: number;
  };
};

export type LicenseDelivery = {
  capabilityId: "langclaw.builder.pass.license";
  install: {
    codex: string;
    oneLineCommands: {
      claudeCode: string;
      codex: string;
      codexNoPlugin: string;
      cursor: string;
      genericMcpProxy: string;
      printCodexConfig: string;
      printMcpConfig: string;
      uninstallCodex: string;
      uninstallClaude: string;
      uninstallCursor: string;
      uninstallWindsurf: string;
      windsurf: string;
    };
    manualMcpConfig: {
      mcpServers: {
        langclaw: {
          args: string[];
          command: "npx";
        };
      };
    };
    mcpUrl: string;
  };
  license: {
    expiresAt: string;
    issuedAt: string;
    label: string;
    maxCalls: number;
    token: string;
  };
  orderId: string;
  service: {
    durationDays: number;
    includedTools: string[];
    name: "Langclaw Builder Pass License";
    slaMinutes: 30;
  };
  status: "delivered";
};

export function buildCapability(): CrooCapability {
  return buildCapabilities()[0];
}

export function buildCapabilities(): CrooCapability[] {
  return [buildResearchCapability(), buildOnchainCapability(), buildLicenseCapability()];
}

function buildResearchCapability(): CrooCapability {
  return {
    id: "langclaw.research.brief",
    name: "Langclaw Research Brief",
    description: "Source-backed research, claim checks, and hackathon fit analysis.",
    priceUsdc: process.env.LANGCLAW_AGENT_PRICE_USDC ?? "0.10",
    inputSchema: {
      type: "object",
      required: ["topic"],
      properties: {
        topic: { type: "string" },
        mode: {
          type: "string",
          enum: ["hackathon-fit", "protocol-research", "claim-verification", "market-brief", "onchain-intelligence"],
        },
        chain: { type: "string" },
        responseLanguage: { type: "string", enum: ["en", "id"] },
        maxDepth: { type: "string", enum: ["quick", "standard", "deep"] },
        context: { type: "string" },
      },
    },
  };
}

function buildOnchainCapability(): CrooCapability {
  return {
    id: "langclaw.onchain.intelligence",
    name: "Langclaw Onchain Intelligence",
    description: "Source-backed onchain intelligence for agents that need read-only chain, token, wallet, contract, protocol, and market context. Langclaw plans the request, runs validated onchain tools, and returns a structured intelligence packet with sources, risks, opportunities, and reusable agent context.",
    priceUsdc: process.env.LANGCLAW_AGENT_PRICE_USDC ?? "0.10",
    inputSchema: {
      type: "object",
      required: ["research_prompt"],
      properties: {
        research_prompt: {
          type: "string",
          description: "What should Langclaw analyze? Include the chain, token, wallet, protocol, contract, transaction, or market signal you want checked.",
        },
        query: {
          type: "string",
          description: "Backward-compatible alias for research_prompt.",
        },
        topic: { type: "string" },
        chain: { type: "string", description: "Preferred chain, for example base, ethereum, arbitrum." },
        scope: {
          type: "string",
          enum: ["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"],
        },
        tokenAddress: { type: "string" },
        walletAddress: { type: "string" },
        contractAddress: { type: "string" },
        transactionHash: { type: "string" },
        timeframe: { type: "string", description: "Preferred time window, for example today, 7d, 30d." },
        targetUse: {
          type: "string",
          description: "How another agent will use the result.",
          enum: [
            "agent-context",
            "campaign-grounding",
            "market-brief",
            "token-due-diligence",
            "wallet-analysis",
            "protocol-research",
            "claim-verification",
            "hackathon-research",
          ],
        },
        responseLanguage: { type: "string", enum: ["en", "id"] },
      },
    },
  };
}

function buildLicenseCapability(): CrooCapability {
  return {
    id: "langclaw.builder.pass.license",
    name: "Langclaw Builder Pass License",
    description: "30-day hosted MCP access for Langclaw research and read-only onchain intelligence tools.",
    priceUsdc: process.env.LANGCLAW_LICENSE_PRICE_USDC ?? "5.00",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string" },
        useCase: { type: "string" },
      },
    },
  };
}

export function buildDelivery(order: CrooOrder, result: ResearchOutput, options: BuildDeliveryOptions = {}): CrooDelivery {
  const capabilityId = order.capabilityId ?? capabilityIdForResult(result);
  if (capabilityId === "langclaw.onchain.intelligence") {
    return buildOnchainIntelligenceDelivery(order, result, options);
  }

  return {
    orderId: order.id,
    capabilityId,
    status: "delivered",
    result,
    proof: {
      deliveryHash: result.deliveryProof.deliveryHash,
      generatedAt: result.deliveryProof.generatedAt,
      inputHash: result.deliveryProof.inputHash,
      sourceCount: result.deliveryProof.sourceCount,
    },
  };
}

function buildOnchainIntelligenceDelivery(
  order: CrooOrder,
  result: ResearchOutput,
  options: BuildDeliveryOptions
): OnchainIntelligenceDelivery {
  const onchain = result.onchain;
  const sourceIds = result.sources.map((source) => source.id);
  const bullets = onchain?.bullets.length ? onchain.bullets : [result.summary];
  const semantic = onchain?.semantic;
  const smartMoney = onchain?.smartMoney;
  const targetUse = order.input.targetUse ?? "agent-context";
  const entities = onchain?.plan.intent.entities ?? [];
  const inputAddresses = [order.input.tokenAddress, order.input.walletAddress, order.input.contractAddress].filter(Boolean) as string[];
  const transactionHashes = [
    ...entities.filter((entity) => entity.type === "transaction").map((entity) => entity.value),
    ...(order.input.transactionHash ? [order.input.transactionHash] : []),
  ];
  const addresses = [
    ...entities.filter((entity) => entity.type !== "transaction").map((entity) => entity.value),
    ...inputAddresses,
  ].filter(isEvmAddress);
  const smartMoneyFields = smartMoney ? buildSmartMoneyDeliveryFields(smartMoney, targetUse) : undefined;

  const deliveryHash = options.a2aWorkPack
    ? stableHash({
        a2aWorkPack: options.a2aWorkPack,
        baseDeliveryHash: result.deliveryProof.deliveryHash,
      })
    : result.deliveryProof.deliveryHash;

  return {
    type: "langclaw-onchain-intelligence",
    version: "1.0",
    orderId: order.id,
    capabilityId: "langclaw.onchain.intelligence",
    status: "delivered",
    request: {
      research_prompt: order.input.topic,
      query: order.input.topic,
      chain: order.input.chain,
      scope: order.input.scope,
      timeframe: order.input.timeframe,
      targetUse,
      responseLanguage: order.input.responseLanguage,
    },
    summary: smartMoneyFields?.summary ?? semantic?.summary ?? result.summary,
    keyFindings: smartMoneyFields?.keyFindings ?? semantic?.keyFindings ?? bullets.slice(0, 5).map((finding, index) => ({
      finding,
      confidence: result.confidence,
      whyItMatters: result.recommendation,
      evidenceIds: sourceIds.length ? sourceIds : [`source-${index + 1}`],
    })),
    signals: smartMoneyFields?.signals ?? semantic?.signals ?? (onchain?.tools ?? []).filter((tool) => tool.status === "success").slice(0, 8).map((tool) => ({
      name: tool.title,
      category: tool.provider,
      strength: result.confidence,
      description: tool.summary,
    })),
    risks: smartMoneyFields?.risks ?? semantic?.risks ?? (onchain?.riskFlags ?? []).map((risk) => ({
      risk: risk.label,
      severity: risk.level === "high" ? "high" : risk.level === "watch" ? "medium" : "low",
      mitigation: risk.detail,
    })),
    opportunities: smartMoneyFields?.opportunities ?? semantic?.opportunities ?? bullets.slice(0, 3).map((opportunity) => ({
      opportunity,
      targetUse,
    })),
    agentReuse: smartMoneyFields?.agentReuse ?? semantic?.agentReuse ?? {
      recommendedUses: [
        "agent-context",
        "campaign-grounding",
        "market-brief",
        "token-due-diligence",
        "wallet-analysis",
        "protocol-research",
      ],
      contentAngles: bullets.slice(0, 5),
      decisionInputs: [result.recommendation, ...(onchain?.riskFlags.map((risk) => risk.detail) ?? [])].filter(Boolean),
    },
    sources: result.sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      type: source.provider,
      observedAt: source.publishedAt,
    })),
    onchainContext: {
      chain: onchain?.plan.intent.chain.id ?? order.input.chain ?? "unknown",
      addresses: dedupe(addresses),
      transactionHashes: dedupe(transactionHashes),
      metrics: onchain?.plan.intent.metrics ?? [],
    },
    a2aWorkPack: options.a2aWorkPack,
    smartMoney,
    limitations: semantic?.limitations ?? [
      "This brief is read-only intelligence and does not execute trades or transactions.",
      "Signals should be rechecked if used for time-sensitive decisions.",
    ],
    proof: {
      deliveryHash,
      inputHash: result.deliveryProof.inputHash,
      generatedAt: result.deliveryProof.generatedAt,
      sourceCount: result.deliveryProof.sourceCount,
    },
  };
}

function buildSmartMoneyDeliveryFields(smartMoney: SmartMoneyInsight, targetUse: AgentTargetUse): Pick<
  OnchainIntelligenceDelivery,
  "agentReuse" | "keyFindings" | "opportunities" | "risks" | "signals" | "summary"
> {
  if (smartMoney.dataQuality.status !== "ok") {
    const unavailable = smartMoney.dataQuality.status === "unavailable";
    return {
      summary: unavailable
        ? `Dune smart-money route was unavailable on ${smartMoney.chain}; no source rows could be delivered.`
        : `Dune smart-money route ran on ${smartMoney.chain}, but no rows matched the configured filters.`,
      keyFindings: [
        {
          finding: unavailable ? "Dune smart-money provider was unavailable." : "No qualifying smart-money rows returned.",
          confidence: "medium",
          whyItMatters: unavailable
            ? "Agents should not treat this as a market signal because the primary flow provider failed."
            : "Agents should treat this as an absence of evidence for the configured filters, not proof that no activity exists.",
          evidenceIds: ["onchain-source-1"],
        },
      ],
      signals: [
        {
          name: unavailable ? "Dune unavailable" : "No rows returned",
          category: "dune",
          strength: "medium",
          description: unavailable
            ? `Route ${smartMoney.dataQuality.route ?? "dune.sql_execute"} did not return usable flow data.`
            : `Route ${smartMoney.dataQuality.route ?? "dune.sql_execute"} returned 0 normalized rows.`,
        },
      ],
      risks: [
        {
          risk: unavailable ? "Provider unavailable" : "No qualifying rows",
          severity: unavailable ? "high" : "medium",
          mitigation: unavailable
            ? "Retry after provider rate limits clear or use a cached Dune execution result."
            : "Retry with a lower minUsd, wider timeframe, or a token-specific prompt.",
        },
        readOnlyRisk(),
      ],
      opportunities: [
        {
          opportunity: "Tune the Dune filter and rerun the scan.",
          targetUse,
        },
      ],
      agentReuse: {
        recommendedUses: [targetUse, "market-brief", "protocol-research"],
        contentAngles: ["No qualifying smart-money rows", "Base Dune filter tuning"],
        decisionInputs: smartMoney.dataQuality.notes,
      },
    };
  }

  const totalUsd = smartMoney.sourceRows.reduce((sum, row) => sum + row.netUsd, 0);
  const topFlow = smartMoney.sourceRows[0];
  const tokenNames = smartMoney.accumulatedTokens.map((token) => token.tokenSymbol).slice(0, 5);
  return {
    summary: `Found ${smartMoney.sourceRows.length} Base smart-money accumulation row(s), ${smartMoney.topWallets.length} wallet(s), ${smartMoney.accumulatedTokens.length} token(s), and ${formatUsd(totalUsd)} visible net buy flow.`,
    keyFindings: [
      {
        finding: `${smartMoney.sourceRows.length} Dune dex.trades accumulation row(s) matched the scan.`,
        confidence: "high",
        whyItMatters: "Requester agents can reuse these rows as concrete wallet-token evidence.",
        evidenceIds: smartMoney.sourceRows.slice(0, 3).map((row) => row.evidenceId),
      },
      {
        finding: tokenNames.length ? `Top accumulated token symbols include ${tokenNames.join(", ")}.` : "No token symbols were available.",
        confidence: "medium",
        whyItMatters: "Token grouping gives another agent an immediate prioritization set.",
        evidenceIds: smartMoney.sourceRows.slice(0, 3).map((row) => row.evidenceId),
      },
      {
        finding: topFlow ? `Largest visible row is ${formatUsd(topFlow.netUsd)} by ${shortAddress(topFlow.wallet)} into ${topFlow.tokenSymbol}.` : "No largest flow row was available.",
        confidence: "medium",
        whyItMatters: "The top row gives a concrete review target.",
        evidenceIds: topFlow ? [topFlow.evidenceId] : ["onchain-source-1"],
      },
    ],
    signals: smartMoney.sourceRows.slice(0, 5).map((row) => ({
      name: `${row.tokenSymbol} accumulation`,
      category: "dune.dex.trades",
      strength: "high" as const,
      description: `${shortAddress(row.wallet)} bought ${formatUsd(row.netUsd)} across ${row.trades} trade(s) in ${row.window || smartMoney.timeframe || "the selected window"}.`,
    })),
    risks: [
      {
        risk: "No wallet labels",
        severity: "medium",
        mitigation: "Treat wallets as raw addresses until label providers confirm identity.",
      },
      {
        risk: "Dune row limit",
        severity: "low",
        mitigation: `Delivery is capped to ${smartMoney.sourceRows.length} normalized row(s); open the Dune result for the full set.`,
      },
      readOnlyRisk(),
    ],
    opportunities: [
      {
        opportunity: "Use top wallets for follow-up wallet analysis.",
        targetUse: "wallet-analysis",
      },
      {
        opportunity: "Use accumulated tokens as market-brief candidates.",
        targetUse: "market-brief",
      },
      {
        opportunity: "Use row evidence as agent workflow context.",
        targetUse,
      },
    ],
    agentReuse: {
      recommendedUses: ["agent-context", "market-brief", "wallet-analysis", "token-due-diligence", "protocol-research"],
      contentAngles: smartMoney.sourceRows.slice(0, 5).map((row) => `${row.tokenSymbol} ${formatUsd(row.netUsd)} by ${shortAddress(row.wallet)}`),
      decisionInputs: smartMoney.sourceRows.slice(0, 6).map((row) => `${row.evidenceId}: ${row.wallet} -> ${row.tokenSymbol} ${formatUsd(row.netUsd)} (${row.trades} trades)`),
    },
  };
}

function readOnlyRisk(): { risk: string; severity: "low"; mitigation: string } {
  return {
    risk: "Read-only analytics",
    severity: "low",
    mitigation: "Use this as intelligence only. Langclaw does not execute swaps, approvals, transfers, or custody.",
  };
}

export function buildLicenseDelivery(orderId: string, license: CreateLicenseResult, publicUrl = process.env.LANGCLAW_PUBLIC_URL ?? "https://langclaw.nanta.tech"): LicenseDelivery {
  const mcpUrl = `${publicUrl.replace(/\/$/, "")}/mcp`;
  const args = ["@langclaw/mcp-client", "--url", mcpUrl, "--token", license.token];
  const codexInstall = `npx @langclaw/mcp-client install-codex --url ${mcpUrl} --token ${license.token}`;
  const baseInstall = `npx @langclaw/mcp-client --url ${mcpUrl} --token ${license.token}`;
  return {
    orderId,
    capabilityId: "langclaw.builder.pass.license",
    status: "delivered",
    license: {
      token: license.token,
      label: license.record.label,
      issuedAt: license.record.issuedAt,
      expiresAt: license.record.expiresAt,
      maxCalls: license.record.maxCalls,
    },
    install: {
      mcpUrl,
      codex: codexInstall,
      oneLineCommands: {
        claudeCode: `npx @langclaw/mcp-client install-claude --url ${mcpUrl} --token ${license.token}`,
        codex: codexInstall,
        codexNoPlugin: `${codexInstall} --no-plugin`,
        cursor: `npx @langclaw/mcp-client install-cursor --url ${mcpUrl} --token ${license.token}`,
        genericMcpProxy: baseInstall,
        printCodexConfig: `npx @langclaw/mcp-client print-codex-config --url ${mcpUrl} --token ${license.token}`,
        printMcpConfig: `npx @langclaw/mcp-client print-mcp-config --url ${mcpUrl} --token ${license.token}`,
        uninstallCodex: "npx @langclaw/mcp-client uninstall-codex",
        uninstallClaude: "npx @langclaw/mcp-client uninstall-claude",
        uninstallCursor: "npx @langclaw/mcp-client uninstall-cursor",
        uninstallWindsurf: "npx @langclaw/mcp-client uninstall-windsurf",
        windsurf: `npx @langclaw/mcp-client install-windsurf --url ${mcpUrl} --token ${license.token}`,
      },
      manualMcpConfig: {
        mcpServers: {
          langclaw: {
            command: "npx",
            args,
          },
        },
      },
    },
    service: {
      name: "Langclaw Builder Pass License",
      durationDays: licenseDurationDays(license.record.issuedAt, license.record.expiresAt),
      slaMinutes: 30,
      includedTools: [
        "langclaw_research",
        "langclaw_onchain_intelligence",
        "langclaw_verify_claim",
        "langclaw_builder_review",
        "langclaw_readiness",
      ],
    },
  };
}

export function formatLicenseDeliveryText(delivery: LicenseDelivery): string {
  const commands = delivery.install.oneLineCommands;
  return [
    "# Langclaw Builder Pass License",
    "",
    "Your license is active.",
    "",
    `License token: ${delivery.license.token}`,
    `Valid until: ${delivery.license.expiresAt}`,
    `Quota: ${delivery.license.maxCalls} MCP tool calls`,
    `MCP endpoint: ${delivery.install.mcpUrl}`,
    "",
    "## Install in Codex",
    "This installs MCP, skill, and plugin.",
    "",
    "```bash",
    commands.codex,
    "```",
    "",
    "## Install in Claude Code CLI",
    "```bash",
    commands.claudeCode,
    "```",
    "",
    "## Install in Cursor",
    "```bash",
    commands.cursor,
    "```",
    "",
    "## Install in Windsurf",
    "```bash",
    commands.windsurf,
    "```",
    "",
    "## Try These Commands in Codex",
    "Use these after installing the Codex plugin.",
    "",
    "```text",
    "/langclaw-research CROO agent market fit",
    "/langclaw-onchain Base smart money last 7 days",
    "/langclaw-builder-review Review this repo for CROO",
    "/langclaw-verify Langclaw supports hosted MCP access",
    "/langclaw-readiness",
    "```",
    "",
    "## Included Tools",
    ...delivery.service.includedTools.map((tool) => `- ${tool}`),
  ].join("\n");
}

function capabilityIdForResult(result: ResearchOutput): CrooCapabilityId {
  return result.onchain ? "langclaw.onchain.intelligence" : "langclaw.research.brief";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function licenseDurationDays(issuedAt: string, expiresAt: string): number {
  const durationMs = new Date(expiresAt).getTime() - new Date(issuedAt).getTime();
  return Math.round(durationMs / (24 * 60 * 60 * 1000));
}

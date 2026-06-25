import type { ResearchInput, ResearchOutput } from "../core/types.js";
import type { CreateLicenseResult } from "../license/types.js";

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
    priceUsdc: process.env.LANGCLAW_AGENT_PRICE_USDC ?? "1.00",
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
    description: "Read-only chain, token, wallet, contract, and protocol analytics.",
    priceUsdc: process.env.LANGCLAW_AGENT_PRICE_USDC ?? "1.00",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        topic: { type: "string" },
        chain: { type: "string" },
        scope: {
          type: "string",
          enum: ["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"],
        },
        tokenAddress: { type: "string" },
        walletAddress: { type: "string" },
        contractAddress: { type: "string" },
        transactionHash: { type: "string" },
        timeframe: { type: "string" },
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

export function buildDelivery(order: CrooOrder, result: ResearchOutput): CrooDelivery {
  return {
    orderId: order.id,
    capabilityId: order.capabilityId ?? capabilityIdForResult(result),
    status: "delivered",
    result,
    proof: {
      deliveryHash: result.deliveryProof.deliveryHash,
      generatedAt: result.deliveryProof.generatedAt,
      sourceCount: result.deliveryProof.sourceCount,
    },
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

function licenseDurationDays(issuedAt: string, expiresAt: string): number {
  const durationMs = new Date(expiresAt).getTime() - new Date(issuedAt).getTime();
  return Math.round(durationMs / (24 * 60 * 60 * 1000));
}

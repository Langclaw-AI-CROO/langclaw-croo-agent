import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getReadiness } from "../core/readiness.js";
import { runCrooResearchAgent } from "../core/run-research.js";
import type { ProviderExecutor } from "../core/onchain/providers.js";
import type { OnchainCommandId } from "../core/onchain/types.js";
import type { ResearchInput } from "../core/types.js";
import type { ResearchProvider } from "../core/types.js";

export const LANGCLAW_SLASH_COMMANDS = [
  "/langclaw",
  "/langclaw-research",
  "/langclaw-onchain",
  "/langclaw-verify",
  "/langclaw-builder-review",
  "/langclaw-readiness",
] as const;

export type LangclawSlashCommand = (typeof LANGCLAW_SLASH_COMMANDS)[number];

export type LangclawCommandInput = {
  chain?: string;
  command: string;
  contractAddress?: string;
  maxDepth?: "quick" | "standard" | "deep";
  program?: string;
  query?: string;
  responseLanguage?: "en" | "id";
  scope?: "chain" | "token" | "protocol" | "wallet" | "contract" | "transaction" | "bridge" | "governance" | "unknown";
  timeframe?: string;
  tokenAddress?: string;
  transactionHash?: string;
  walletAddress?: string;
};

export type LangclawCommandResult = {
  data: unknown;
  markdown: string;
  routedTool?: string;
};

export const LANGCLAW_TOOL_DEFINITIONS = [
  {
    name: "langclaw_command",
    description: "Route slash-style Langclaw commands to the right research, onchain, verification, builder review, or readiness tool.",
  },
  {
    name: "langclaw_research",
    description: "Research a protocol, project, token, market topic, or agent idea.",
  },
  {
    name: "langclaw_verify_claim",
    description: "Check whether a claim has enough source support.",
  },
  {
    name: "langclaw_builder_review",
    description: "Review whether a project fits a builder program, hackathon, grant, or submission goal.",
  },
  {
    name: "langclaw_onchain_intelligence",
    description: "Run read-only chain, token, wallet, contract, transaction, bridge, governance, or protocol analytics.",
  },
  {
    name: "langclaw_readiness",
    description: "Check local provider, model, MCP, and CROO configuration.",
  },
];

const inputSchema = {
  topic: z.string().min(1),
  mode: z
    .enum(["hackathon-fit", "protocol-research", "claim-verification", "market-brief", "onchain-intelligence"])
    .optional(),
  chain: z.string().optional(),
  responseLanguage: z.enum(["en", "id"]).optional(),
  maxDepth: z.enum(["quick", "standard", "deep"]).optional(),
  context: z.string().optional(),
  scope: z
    .enum(["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"])
    .optional(),
  tokenAddress: z.string().optional(),
  walletAddress: z.string().optional(),
  contractAddress: z.string().optional(),
  transactionHash: z.string().optional(),
  timeframe: z.string().optional(),
};

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "langclaw-croo-agent",
    version: "0.1.0",
  });

  server.tool(
    "langclaw_command",
    LANGCLAW_TOOL_DEFINITIONS[0].description,
    {
      command: z.string().min(1),
      query: z.string().optional(),
      chain: z.string().optional(),
      scope: z
        .enum(["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"])
        .optional(),
      tokenAddress: z.string().optional(),
      walletAddress: z.string().optional(),
      contractAddress: z.string().optional(),
      transactionHash: z.string().optional(),
      timeframe: z.string().optional(),
      program: z.string().optional(),
      responseLanguage: z.enum(["en", "id"]).optional(),
      maxDepth: z.enum(["quick", "standard", "deep"]).optional(),
    },
    async (args) => {
      const result = await runLangclawCommand(args as LangclawCommandInput);
      return textResult(result.markdown, result.data);
    }
  );

  server.tool(
    "langclaw_research",
    LANGCLAW_TOOL_DEFINITIONS[1].description,
    inputSchema,
    async (args) => {
      const result = await runCrooResearchAgent(args as ResearchInput);
      return textResult(result.markdown, result);
    }
  );

  server.tool(
    "langclaw_verify_claim",
    LANGCLAW_TOOL_DEFINITIONS[2].description,
    {
      claim: z.string().min(1),
      context: z.string().optional(),
      responseLanguage: z.enum(["en", "id"]).optional(),
      maxDepth: z.enum(["quick", "standard", "deep"]).optional(),
    },
    async (args) => {
      const result = await runCrooResearchAgent({
        topic: args.claim,
        context: args.context,
        responseLanguage: args.responseLanguage,
        maxDepth: args.maxDepth,
        mode: "claim-verification",
      });
      return textResult(result.markdown, result);
    }
  );

  server.tool(
    "langclaw_builder_review",
    LANGCLAW_TOOL_DEFINITIONS[3].description,
    {
      project: z.string().min(1),
      program: z.string().min(1),
      responseLanguage: z.enum(["en", "id"]).optional(),
      maxDepth: z.enum(["quick", "standard", "deep"]).optional(),
    },
    async (args) => {
      const result = await runCrooResearchAgent({
        topic: `${args.project} for ${args.program}`,
        responseLanguage: args.responseLanguage,
        maxDepth: args.maxDepth,
        mode: "hackathon-fit",
      });
      return textResult(result.markdown, result);
    }
  );

  server.tool(
    "langclaw_onchain_intelligence",
    LANGCLAW_TOOL_DEFINITIONS[4].description,
    {
      query: z.string().min(1),
      chain: z.string().optional(),
      scope: z
        .enum(["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"])
        .optional(),
      tokenAddress: z.string().optional(),
      walletAddress: z.string().optional(),
      contractAddress: z.string().optional(),
      transactionHash: z.string().optional(),
      timeframe: z.string().optional(),
      responseLanguage: z.enum(["en", "id"]).optional(),
    },
    async (args) => {
      const result = await runCrooResearchAgent({
        topic: args.query,
        chain: args.chain,
        scope: args.scope,
        tokenAddress: args.tokenAddress,
        walletAddress: args.walletAddress,
        contractAddress: args.contractAddress,
        transactionHash: args.transactionHash,
        timeframe: args.timeframe,
        responseLanguage: args.responseLanguage,
        mode: "onchain-intelligence",
      });
      return textResult(result.markdown, result);
    }
  );

  server.tool(
    "langclaw_readiness",
    LANGCLAW_TOOL_DEFINITIONS[5].description,
    {},
    async () => {
      const result = getReadiness();
      return textResult(JSON.stringify(result, null, 2), result);
    }
  );

  return server;
}

export async function runLangclawCommand(
  args: LangclawCommandInput,
  deps: {
    onchainExecutors?: Partial<Record<OnchainCommandId, ProviderExecutor>>;
    providers?: ResearchProvider[];
    now?: () => Date;
  } = {}
): Promise<LangclawCommandResult> {
  const parsed = parseSlashCommand(args.command);
  if (!parsed.command) {
    const data = {
      error: `Unsupported Langclaw command: ${args.command}`,
      supportedCommands: LANGCLAW_SLASH_COMMANDS,
    };
    return {
      data,
      markdown: [
        `Unsupported Langclaw command: ${args.command}`,
        "",
        "Supported commands:",
        ...LANGCLAW_SLASH_COMMANDS.map((command) => `- ${command}`),
      ].join("\n"),
    };
  }

  const query = (args.query?.trim() || parsed.query || "").trim();
  if (parsed.command === "/langclaw-readiness") {
    const data = getReadiness();
    return {
      data,
      markdown: JSON.stringify(data, null, 2),
      routedTool: "langclaw_readiness",
    };
  }

  if (!query) {
    const data = {
      command: parsed.command,
      error: "query is required",
    };
    return {
      data,
      markdown: `${parsed.command} requires a query.`,
    };
  }

  if (parsed.command === "/langclaw-onchain") {
    const result = await runCrooResearchAgent(
      {
        ...sharedResearchInput(args, query),
        mode: "onchain-intelligence",
      },
      deps
    );
    return { data: result, markdown: result.markdown, routedTool: "langclaw_onchain_intelligence" };
  }

  if (parsed.command === "/langclaw-verify") {
    const result = await runCrooResearchAgent(
      {
        topic: query,
        context: args.program,
        responseLanguage: args.responseLanguage,
        maxDepth: args.maxDepth,
        mode: "claim-verification",
      },
      deps
    );
    return { data: result, markdown: result.markdown, routedTool: "langclaw_verify_claim" };
  }

  if (parsed.command === "/langclaw-builder-review") {
    const program = args.program?.trim() || "builder program";
    const result = await runCrooResearchAgent(
      {
        topic: `${query} for ${program}`,
        responseLanguage: args.responseLanguage,
        maxDepth: args.maxDepth,
        mode: "hackathon-fit",
      },
      deps
    );
    return { data: result, markdown: result.markdown, routedTool: "langclaw_builder_review" };
  }

  const result = await runCrooResearchAgent(
    {
      ...sharedResearchInput(args, query),
      mode: parsed.command === "/langclaw-research" ? "protocol-research" : undefined,
    },
    deps
  );
  return { data: result, markdown: result.markdown, routedTool: "langclaw_research" };
}

function parseSlashCommand(rawCommand: string): { command?: LangclawSlashCommand; query: string } {
  const [first = "", ...rest] = rawCommand.trim().split(/\s+/);
  const command = LANGCLAW_SLASH_COMMANDS.find((item) => item === first.toLowerCase());
  return {
    command,
    query: rest.join(" ").trim(),
  };
}

function sharedResearchInput(args: LangclawCommandInput, topic: string): ResearchInput {
  return {
    topic,
    chain: args.chain,
    responseLanguage: args.responseLanguage,
    maxDepth: args.maxDepth,
    scope: args.scope,
    tokenAddress: args.tokenAddress,
    walletAddress: args.walletAddress,
    contractAddress: args.contractAddress,
    transactionHash: args.transactionHash,
    timeframe: args.timeframe,
  };
}

function textResult(text: string, data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
      {
        type: "text" as const,
        text: `\n\nJSON\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

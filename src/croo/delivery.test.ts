import assert from "node:assert/strict";
import test from "node:test";

import { buildCapabilities, buildCapability, buildDelivery, buildLicenseDelivery, formatLicenseDeliveryText } from "./delivery.js";
import type { ResearchOutput } from "../core/types.js";

test("buildCapability exposes the paid research brief capability", () => {
  const capability = buildCapability();

  assert.equal(capability.id, "langclaw.research.brief");
  assert.equal(capability.inputSchema.type, "object");
});

test("buildCapabilities exposes the license pass capability", () => {
  const capabilities = buildCapabilities();

  assert.ok(capabilities.some((capability) => capability.id === "langclaw.builder.pass.license"));
});

test("buildDelivery maps research output to CROO delivery payload", () => {
  const result: ResearchOutput = {
    title: "Title",
    summary: "Summary",
    recommendation: "Recommendation",
    confidence: "medium",
    sources: [],
    providerTrace: [],
    markdown: "# Title",
    deliveryProof: {
      deliveryHash: "abc",
      generatedAt: "2026-06-24T00:00:00.000Z",
      inputHash: "def",
      sourceCount: 0,
      executionLog: [],
    },
  };

  const delivery = buildDelivery(
    {
      id: "order-1",
      input: { topic: "CROO" },
    },
    result
  );

  assert.equal(delivery.orderId, "order-1");
  assert.equal(delivery.capabilityId, "langclaw.research.brief");
  assert.equal(delivery.proof.deliveryHash, "abc");
  assert.equal(delivery.proof.inputHash, "def");
});

test("buildDelivery maps onchain output to reusable intelligence packet", () => {
  const result: ResearchOutput = {
    title: "Base signals",
    summary: "Base shows useful ecosystem signals.",
    recommendation: "Use this as agent context.",
    confidence: "medium",
    sources: [
      {
        id: "source-1",
        title: "Source",
        url: "https://example.test/source",
        provider: "onchain",
        excerpt: "Evidence",
      },
    ],
    providerTrace: [],
    markdown: "# Base signals",
    deliveryProof: {
      deliveryHash: "hash-1",
      generatedAt: "2026-06-25T00:00:00.000Z",
      inputHash: "input-hash-1",
      sourceCount: 1,
      executionLog: [],
    },
    onchain: {
      title: "Base signals",
      answer: "Base shows useful ecosystem signals.",
      bullets: ["Stablecoin activity is a useful demand signal."],
      recommendation: "Use this as agent context.",
      caveat: "Recheck time-sensitive data.",
      generatedAt: "2026-06-25T00:00:00.000Z",
      confidence: "medium",
      riskFlags: [
        {
          level: "watch",
          label: "Router noise",
          detail: "Filter routing spikes before treating activity as demand.",
        },
      ],
      plan: {
        intent: {
          originalQuery: "Base ecosystem signals",
          rewrittenQuery: "Base ecosystem signals",
          scope: "chain",
          entities: [],
          metrics: ["stablecoins"],
          timeframe: "7d",
          chain: {
            aliases: ["base"],
            dexscreenerId: "base",
            geckoterminalId: "base",
            id: "base",
            name: "Base",
            nativeSymbol: "ETH",
          },
          confidence: 0.8,
          debug: {
            selectedScope: "chain",
            scopeReason: "test",
            extractedAddresses: [],
            preservationCheck: "preserved",
          },
        },
        selectedRoute: "chain",
        commands: [],
        fallbackPolicy: [],
        blockedFallbacks: [],
        providerGaps: [],
        debug: {
          commandCount: 0,
          rejectedCommands: [],
          finalStatus: "planned",
        },
      },
      tools: [
        {
          commandId: "defillama.stablecoins",
          title: "Stablecoins",
          provider: "defillama",
          status: "success",
          latencyMs: 10,
          summary: "Stablecoin supply checked.",
          sourceUrl: "https://example.test/source",
        },
      ],
      providerTrace: [],
      sourceUrls: ["https://example.test/source"],
      markdown: "# Base signals",
      semantic: {
        summary: "Semantic summary for requester agents.",
        keyFindings: [
          {
            finding: "Semantic finding.",
            confidence: "high",
            whyItMatters: "It improves agent reuse.",
            evidenceIds: ["source-1"],
          },
        ],
        signals: [
          {
            name: "Semantic signal",
            category: "market",
            strength: "high",
            description: "Semantic signal description.",
          },
        ],
        risks: [
          {
            risk: "Semantic risk",
            severity: "medium",
            mitigation: "Review sources.",
          },
        ],
        opportunities: [
          {
            opportunity: "Semantic opportunity",
            targetUse: "market-brief",
          },
        ],
        agentReuse: {
          recommendedUses: ["agent-context", "market-brief"],
          contentAngles: ["Semantic angle"],
          decisionInputs: ["Semantic decision input"],
        },
        limitations: ["Semantic limitation."],
      },
    },
  };

  const delivery = buildDelivery(
    {
      id: "order-onchain-1",
      capabilityId: "langclaw.onchain.intelligence",
      input: {
        topic: "Base ecosystem signals",
        chain: "base",
        scope: "chain",
        timeframe: "7d",
        targetUse: "agent-context",
        responseLanguage: "en",
      },
    },
    result
  );

  assert.equal(delivery.orderId, "order-onchain-1");
  assert.equal(delivery.capabilityId, "langclaw.onchain.intelligence");
  assert.equal(delivery.status, "delivered");
  assert.equal(delivery.proof.deliveryHash, "hash-1");
  assert.equal(delivery.proof.inputHash, "input-hash-1");
  assert.equal("type" in delivery ? delivery.type : "", "langclaw-onchain-intelligence");
  if ("type" in delivery) {
    assert.equal(delivery.version, "1.0");
    assert.equal(delivery.request.research_prompt, "Base ecosystem signals");
    assert.equal(delivery.summary, "Semantic summary for requester agents.");
    assert.equal(delivery.keyFindings[0]?.finding, "Semantic finding.");
    assert.equal(delivery.signals[0]?.name, "Semantic signal");
    assert.equal(delivery.risks[0]?.risk, "Semantic risk");
    assert.equal(delivery.request.targetUse, "agent-context");
    assert.ok(delivery.agentReuse.recommendedUses.includes("market-brief"));
    assert.equal(delivery.sources[0]?.url, "https://example.test/source");
    assert.deepEqual(delivery.onchainContext.metrics, ["stablecoins"]);
    assert.doesNotMatch(JSON.stringify(delivery), /reasoningMode|reasoningProvider|reasoningModel|gpt-|OpenAI/);
  }
});

test("buildDelivery includes smart-money rows when Dune data is available", () => {
  const result: ResearchOutput = {
    title: "Base smart money",
    summary: "Completed onchain checks.",
    recommendation: "Use the source rows.",
    confidence: "high",
    sources: [
      {
        id: "onchain-source-1",
        title: "Dune dex.trades smart-money result",
        url: "https://example.test/dune",
        provider: "onchain",
        excerpt: "Executed Dune dynamic SQL.",
      },
    ],
    providerTrace: [],
    markdown: "# Base smart money",
    deliveryProof: {
      deliveryHash: "hash-smart-money",
      generatedAt: "2026-06-25T00:00:00.000Z",
      inputHash: "input-hash-smart-money",
      sourceCount: 1,
      executionLog: [],
    },
    onchain: {
      title: "Base smart money",
      answer: "Found 2 visible smart-money rows.",
      bullets: ["Dune found rows."],
      recommendation: "Use the source rows.",
      caveat: "Read-only analytics.",
      generatedAt: "2026-06-25T00:00:00.000Z",
      confidence: "high",
      riskFlags: [],
      plan: {
        intent: {
          originalQuery: "smart money on Base",
          rewrittenQuery: "smart money on Base",
          scope: "token",
          entities: [
            {
              confidence: 1,
              type: "chain",
              value: "Base",
            },
          ],
          metrics: ["smart-money"],
          timeframe: "7d",
          chain: {
            aliases: ["base"],
            dexscreenerId: "base",
            geckoterminalId: "base",
            id: "base",
            name: "Base",
            nativeSymbol: "ETH",
          },
          confidence: 0.9,
          debug: {
            selectedScope: "token",
            scopeReason: "test",
            extractedAddresses: [],
            preservationCheck: "preserved",
          },
        },
        selectedRoute: "token",
        commands: [],
        fallbackPolicy: [],
        blockedFallbacks: [],
        providerGaps: [],
        debug: {
          commandCount: 0,
          rejectedCommands: [],
          finalStatus: "planned",
        },
      },
      providerTrace: [],
      sourceUrls: ["https://example.test/dune"],
      tools: [],
      markdown: "# Base smart money",
      smartMoney: {
        accumulatedTokens: [
          {
            netUsd: 42000,
            tokenAddress: "0x0000000000000000000000000000000000000001",
            tokenSymbol: "AERO",
            tradeCount: 4,
            walletCount: 2,
          },
        ],
        chain: "base",
        dataQuality: {
          chain: "base",
          minUsd: 10000,
          notes: ["Rows are normalized from Dune dex.trades output."],
          returnedRows: 2,
          route: "dune.sql_execute.dex_accumulation",
          status: "ok",
          windowDays: 7,
        },
        flows: [
          {
            dataSource: "Dune dex.trades dynamic SQL",
            evidenceId: "smart-money-row-1",
            netUsd: 25000,
            signal: "dex_accumulation_candidate",
            tokenAddress: "0x0000000000000000000000000000000000000001",
            tokenSymbol: "AERO",
            trades: 2,
            wallet: "0x1111111111111111111111111111111111111111",
            window: "2026-06-18 to 2026-06-25",
          },
          {
            dataSource: "Dune dex.trades dynamic SQL",
            evidenceId: "smart-money-row-2",
            netUsd: 17000,
            signal: "dex_accumulation_candidate",
            tokenAddress: "0x0000000000000000000000000000000000000001",
            tokenSymbol: "AERO",
            trades: 2,
            wallet: "0x2222222222222222222222222222222222222222",
            window: "2026-06-18 to 2026-06-25",
          },
        ],
        minUsd: 10000,
        sourceRows: [
          {
            dataSource: "Dune dex.trades dynamic SQL",
            evidenceId: "smart-money-row-1",
            netUsd: 25000,
            signal: "dex_accumulation_candidate",
            tokenAddress: "0x0000000000000000000000000000000000000001",
            tokenSymbol: "AERO",
            trades: 2,
            wallet: "0x1111111111111111111111111111111111111111",
            window: "2026-06-18 to 2026-06-25",
          },
        ],
        timeframe: "7d",
        topWallets: [
          {
            netUsd: 25000,
            tokenCount: 1,
            tokens: ["AERO"],
            tradeCount: 2,
            wallet: "0x1111111111111111111111111111111111111111",
          },
        ],
      },
    },
  };

  const delivery = buildDelivery(
    {
      id: "order-smart-money-1",
      capabilityId: "langclaw.onchain.intelligence",
      input: {
        topic: "smart money on Base",
        chain: "base",
        scope: "chain",
        timeframe: "7d",
        targetUse: "agent-context",
        responseLanguage: "en",
      },
    },
    result
  );

  assert.equal("type" in delivery ? delivery.type : "", "langclaw-onchain-intelligence");
  if ("type" in delivery) {
    assert.equal(delivery.smartMoney?.dataQuality.status, "ok");
    assert.equal(delivery.smartMoney?.topWallets[0]?.wallet, "0x1111111111111111111111111111111111111111");
    assert.equal(delivery.smartMoney?.accumulatedTokens[0]?.tokenSymbol, "AERO");
    assert.match(delivery.summary, /Base smart-money accumulation/);
    assert.deepEqual(delivery.onchainContext.addresses, []);
    assert.equal(delivery.sources[0]?.title, "Dune dex.trades smart-money result");
    assert.ok(delivery.keyFindings[0]?.evidenceIds.includes("smart-money-row-1"));
    assert.doesNotMatch(JSON.stringify(delivery), /reasoningMode|reasoningProvider|reasoningModel|gpt-|OpenAI|sk-/);
  }
});

test("buildDelivery reports no rows for empty smart-money output", () => {
  const baseResult: ResearchOutput = {
    title: "Base smart money",
    summary: "Completed onchain checks.",
    recommendation: "Tune the filters.",
    confidence: "medium",
    sources: [],
    providerTrace: [],
    markdown: "# Base smart money",
    deliveryProof: {
      deliveryHash: "hash-empty-smart-money",
      generatedAt: "2026-06-25T00:00:00.000Z",
      inputHash: "input-hash-empty-smart-money",
      sourceCount: 0,
      executionLog: [],
    },
    onchain: {
      title: "Base smart money",
      answer: "No rows.",
      bullets: ["No rows."],
      recommendation: "Tune the filters.",
      caveat: "No qualifying rows.",
      generatedAt: "2026-06-25T00:00:00.000Z",
      confidence: "medium",
      riskFlags: [],
      plan: {
        intent: {
          originalQuery: "smart money on Base",
          rewrittenQuery: "smart money on Base",
          scope: "token",
          entities: [],
          metrics: ["smart-money"],
          timeframe: "7d",
          chain: {
            aliases: ["base"],
            dexscreenerId: "base",
            geckoterminalId: "base",
            id: "base",
            name: "Base",
            nativeSymbol: "ETH",
          },
          confidence: 0.9,
          debug: {
            selectedScope: "token",
            scopeReason: "test",
            extractedAddresses: [],
            preservationCheck: "preserved",
          },
        },
        selectedRoute: "token",
        commands: [],
        fallbackPolicy: [],
        blockedFallbacks: [],
        providerGaps: [],
        debug: {
          commandCount: 0,
          rejectedCommands: [],
          finalStatus: "planned",
        },
      },
      providerTrace: [],
      sourceUrls: [],
      tools: [],
      markdown: "# Base smart money",
      smartMoney: {
        accumulatedTokens: [],
        chain: "base",
        dataQuality: {
          chain: "base",
          minUsd: 10000,
          notes: ["Dune execution completed, but no qualifying rows were returned for the selected filters."],
          returnedRows: 0,
          route: "dune.sql_execute.dex_accumulation",
          status: "no_rows_returned",
          windowDays: 7,
        },
        flows: [],
        minUsd: 10000,
        sourceRows: [],
        timeframe: "7d",
        topWallets: [],
      },
    },
  };

  const delivery = buildDelivery(
    {
      id: "order-smart-money-empty",
      capabilityId: "langclaw.onchain.intelligence",
      input: {
        topic: "smart money on Base",
        chain: "base",
        scope: "chain",
      },
    },
    baseResult
  );

  if ("type" in delivery) {
    assert.equal(delivery.smartMoney?.dataQuality.status, "no_rows_returned");
    assert.match(delivery.summary, /no rows matched/);
  }
});

test("buildLicenseDelivery returns install command and license metadata", () => {
  const delivery = buildLicenseDelivery(
    "order-license-1",
    {
      token: "lc_live_test",
      record: {
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-07-24T00:00:00.000Z",
        issuedAt: "2026-06-24T00:00:00.000Z",
        label: "buyer",
        maxCalls: 300,
        status: "active",
        tokenHash: "hash",
        usedCalls: 0,
      },
    },
    "https://langclaw.nanta.tech"
  );

  assert.equal(delivery.capabilityId, "langclaw.builder.pass.license");
  assert.equal(delivery.license.expiresAt, "2026-07-24T00:00:00.000Z");
  assert.match(delivery.install.codex, /lc_live_test/);
  assert.match(delivery.install.codex, /https:\/\/langclaw\.nanta\.tech\/mcp/);
  assert.equal(delivery.install.oneLineCommands.codex, delivery.install.codex);
  assert.match(delivery.install.oneLineCommands.codexNoPlugin, /--no-plugin/);
  assert.match(delivery.install.oneLineCommands.claudeCode, /install-claude/);
  assert.match(delivery.install.oneLineCommands.cursor, /install-cursor/);
  assert.match(delivery.install.oneLineCommands.windsurf, /install-windsurf/);
  assert.match(delivery.install.oneLineCommands.genericMcpProxy, /^npx @langclaw\/mcp-client --url/);
  assert.match(delivery.install.oneLineCommands.printCodexConfig, /print-codex-config/);
  assert.match(delivery.install.oneLineCommands.printMcpConfig, /print-mcp-config/);
  assert.equal(delivery.install.oneLineCommands.uninstallCodex, "npx @langclaw/mcp-client uninstall-codex");
  assert.match(JSON.stringify(delivery.install.oneLineCommands), /lc_live_test/);
  assert.ok(delivery.service.includedTools.includes("langclaw_onchain_intelligence"));
  assert.doesNotMatch(JSON.stringify(delivery), /TAVILY|DUNE|ALCHEMY|CROO_API_KEY/);
});

test("formatLicenseDeliveryText returns readable buyer instructions", () => {
  const delivery = buildLicenseDelivery(
    "order-license-1",
    {
      token: "lc_live_test",
      record: {
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-07-24T00:00:00.000Z",
        issuedAt: "2026-06-24T00:00:00.000Z",
        label: "buyer",
        maxCalls: 300,
        status: "active",
        tokenHash: "hash",
        usedCalls: 0,
      },
    },
    "https://langclaw.nanta.tech"
  );

  const text = formatLicenseDeliveryText(delivery);

  assert.match(text, /^# Langclaw Builder Pass License/);
  assert.match(text, /lc_live_test/);
  assert.match(text, /2026-07-24T00:00:00.000Z/);
  assert.match(text, /300 MCP tool calls/);
  assert.match(text, /install-codex/);
  assert.match(text, /install-claude/);
  assert.match(text, /install-cursor/);
  assert.match(text, /install-windsurf/);
  assert.match(text, /Try These Commands in Codex/);
  assert.match(text, /\/langclaw-onchain Base smart money last 7 days/);
  assert.match(text, /\/langclaw-readiness/);
  assert.match(text, /langclaw_onchain_intelligence/);
  assert.doesNotMatch(text, /Generic MCP Proxy/);
  assert.doesNotMatch(text, /print-mcp-config/);
  assert.doesNotMatch(text, /## Full JSON Payload/);
  assert.doesNotMatch(text, /TAVILY|DUNE|ALCHEMY|CROO_API_KEY/);
});

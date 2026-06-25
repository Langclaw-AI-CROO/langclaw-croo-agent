import assert from "node:assert/strict";
import test from "node:test";

import { runOnchainIntelligence } from "./workflow.js";
import { OnchainReasoningError, type OnchainReasoner } from "./reasoning.js";

test("workflow runs with mocked providers", async () => {
  const result = await runOnchainIntelligence(
    { query: "Base chain TVL today" },
    {
      executors: {
        "defillama.chain_tvl": async () => ({
          data: { tvl: 1 },
          sourceUrl: "https://example.test/tvl",
          summary: "Fetched chain TVL.",
        }),
        "defillama.stablecoins": async () => ({
          data: { stablecoins: 1 },
          sourceUrl: "https://example.test/stables",
          summary: "Fetched stablecoins.",
        }),
        "dexscreener.latest_profiles": async () => ({
          data: [],
          sourceUrl: "https://example.test/profiles",
          summary: "Fetched profiles.",
        }),
        "dexscreener.latest_boosts": async () => ({
          data: [],
          sourceUrl: "https://example.test/boosts",
          summary: "Fetched boosts.",
        }),
        "dexscreener.top_boosts": async () => ({
          data: [],
          sourceUrl: "https://example.test/top",
          summary: "Fetched top boosts.",
        }),
        "local.synthesis": async () => ({
          data: { done: true },
          summary: "Synthesized results.",
        }),
      },
    }
  );

  assert.equal(result.plan.intent.scope, "chain");
  assert.ok(result.tools.length > 0);
  assert.match(result.markdown, /Base Chain Intelligence/);
});

test("workflow keeps Dune dynamic SQL same-scope", async () => {
  const previousKey = process.env.DUNE_API_KEY;
  process.env.DUNE_API_KEY = "test-key";
  try {
    const result = await runOnchainIntelligence(
      { query: "smart money accumulation on Base last 7 days" },
      {
        executors: {
          "dune.sql_execute": async () => ({
            data: { rows: [{ wallet: "0x1" }] },
            routeDebug: {
              generatedRoute: "dune.sql_execute.dex_accumulation",
              minUsd: 10000,
              selectedChain: "base",
              tableFamily: "dex.trades",
              windowDays: 7,
            },
            sourceUrl: "https://example.test/dune",
            summary: "Executed Dune dynamic SQL.",
          }),
          "dexscreener.search_pairs": async () => ({
            data: [],
            sourceUrl: "https://example.test/pairs",
            summary: "Fetched pairs.",
          }),
          "coingecko.market_context": async () => ({
            data: {},
            sourceUrl: "https://example.test/market",
            summary: "Fetched market context.",
          }),
          "local.synthesis": async () => ({
            data: { done: true },
            summary: "Synthesized results.",
          }),
        },
      }
    );

    assert.equal(result.plan.intent.scope, "token");
    assert.equal(result.tools[0]?.commandId, "dune.sql_execute");
    assert.equal(result.tools[0]?.routeDebug?.selectedChain, "base");
  } finally {
    process.env.DUNE_API_KEY = previousKey;
  }
});

test("workflow uses semantic intent planning before tool selection", async () => {
  const reasoner: OnchainReasoner = {
    async planIntent() {
      return {
        normalizedQuery: "Analyze Base smart money accumulation last 7 days",
        chain: "base",
        scope: "token",
        entities: [],
        timeframe: "7d",
        toolHints: ["dune.sql_execute", "dexscreener.search_pairs"],
        safetyDecision: "safe",
        refusalReason: "",
      };
    },
    async synthesize(output) {
      return {
        summary: "Semantic summary over Dune and market evidence.",
        keyFindings: [
          {
            finding: "Dune evidence was prioritized for smart-money accumulation.",
            confidence: "high",
            whyItMatters: "Requester agents can reuse the accumulation signal.",
            evidenceIds: ["onchain-source-1"],
          },
        ],
        signals: [
          {
            name: "Accumulation route",
            category: "dune",
            strength: "high",
            description: "Dune was selected from the semantic hint allowlist.",
          },
        ],
        risks: [],
        opportunities: [
          {
            opportunity: "Use as market brief context.",
            targetUse: "market-brief",
          },
        ],
        agentReuse: {
          recommendedUses: ["agent-context", "market-brief"],
          contentAngles: ["Smart-money accumulation"],
          decisionInputs: ["Review Dune route output."],
        },
        limitations: ["Partial evidence in mock test."],
      };
    },
  };
  const previousKey = process.env.DUNE_API_KEY;
  process.env.DUNE_API_KEY = "test-key";
  try {
    const result = await runOnchainIntelligence(
      { query: "What is happening with smart money?" },
      {
        reasoner,
        executors: {
          "dune.sql_execute": async () => ({
            data: { rows: [] },
            sourceUrl: "https://example.test/dune",
            summary: "Executed Dune dynamic SQL.",
          }),
          "dexscreener.search_pairs": async () => ({
            data: [],
            sourceUrl: "https://example.test/pairs",
            summary: "Fetched pairs.",
          }),
          "coingecko.market_context": async () => ({
            data: {},
            sourceUrl: "https://example.test/market",
            summary: "Fetched market context.",
          }),
          "local.synthesis": async () => ({
            data: {},
            summary: "Synthesized results.",
          }),
        },
      }
    );

    assert.equal(result.plan.intent.scope, "token");
    assert.equal(result.tools[0]?.commandId, "dune.sql_execute");
    assert.equal(result.answer, "Semantic summary over Dune and market evidence.");
    assert.equal(result.semantic?.keyFindings[0]?.confidence, "high");
  } finally {
    process.env.DUNE_API_KEY = previousKey;
  }
});

test("workflow blocks non read-only onchain requests before reasoning", async () => {
  await assert.rejects(
    () => runOnchainIntelligence({ query: "Sign and swap 10 USDC to this token on Base" }, { reasoner: false }),
    OnchainReasoningError
  );
});

test("workflow falls back to local synthesis when semantic synthesis fails", async () => {
  const reasoner: OnchainReasoner = {
    async planIntent(input) {
      return {
        normalizedQuery: input.query,
        chain: "base",
        scope: "chain",
        entities: [],
        timeframe: "",
        toolHints: [],
        safetyDecision: "safe",
        refusalReason: "",
      };
    },
    async synthesize() {
      throw new Error("mock semantic synthesis failure");
    },
  };

  const result = await runOnchainIntelligence(
    { query: "Base chain TVL today" },
    {
      reasoner,
      executors: {
        "defillama.chain_tvl": async () => ({
          data: { tvl: 1 },
          sourceUrl: "https://example.test/tvl",
          summary: "Fetched chain TVL.",
        }),
        "defillama.stablecoins": async () => ({
          data: {},
          sourceUrl: "https://example.test/stables",
          summary: "Fetched stablecoins.",
        }),
        "dexscreener.latest_profiles": async () => ({
          data: [],
          sourceUrl: "https://example.test/profiles",
          summary: "Fetched profiles.",
        }),
        "dexscreener.latest_boosts": async () => ({
          data: [],
          sourceUrl: "https://example.test/boosts",
          summary: "Fetched boosts.",
        }),
        "dexscreener.top_boosts": async () => ({
          data: [],
          sourceUrl: "https://example.test/top",
          summary: "Fetched top boosts.",
        }),
        "local.synthesis": async () => ({
          data: {},
          summary: "Synthesized results.",
        }),
      },
    }
  );

  assert.equal(result.semantic, undefined);
  assert.match(result.answer, /Completed/);
});

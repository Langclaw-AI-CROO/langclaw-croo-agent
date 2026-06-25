import assert from "node:assert/strict";
import test from "node:test";

import { runOnchainIntelligence } from "./workflow.js";

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

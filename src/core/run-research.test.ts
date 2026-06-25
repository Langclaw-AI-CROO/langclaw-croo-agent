import assert from "node:assert/strict";
import test from "node:test";

import { runCrooResearchAgent } from "./run-research.js";
import type { ResearchProvider } from "./types.js";

const provider: ResearchProvider = {
  name: "TestProvider",
  async search() {
    return [
      {
        id: "source-1",
        title: "CROO docs",
        url: "https://docs.example.test/croo",
        provider: "TestProvider",
        excerpt: "Agent commerce docs.",
      },
      {
        id: "source-2",
        title: "Agent store",
        url: "https://docs.example.test/store",
        provider: "TestProvider",
        excerpt: "Agent listing docs.",
      },
    ];
  },
};

test("runCrooResearchAgent returns structured delivery output", async () => {
  const result = await runCrooResearchAgent(
    {
      topic: "CROO research agent",
      mode: "hackathon-fit",
      responseLanguage: "en",
    },
    {
      providers: [provider],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    }
  );

  assert.equal(result.title, "Hackathon Fit: CROO research agent");
  assert.equal(result.sources.length, 2);
  assert.equal(result.providerTrace[0]?.status, "success");
  assert.equal(result.deliveryProof.sourceCount, 2);
  assert.match(result.deliveryProof.deliveryHash, /^[a-f0-9]{64}$/);
  assert.match(result.markdown, /Delivery Proof/);
});

test("runCrooResearchAgent rejects empty topic", async () => {
  await assert.rejects(() => runCrooResearchAgent({ topic: "" }), /topic is required/);
});

test("runCrooResearchAgent integrates onchain intelligence mode", async () => {
  const result = await runCrooResearchAgent(
    {
      topic: "Base chain TVL today",
      mode: "onchain-intelligence",
    },
    {
      onchainExecutors: {
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
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    }
  );

  assert.ok(result.onchain);
  assert.equal(result.onchain.plan.intent.scope, "chain");
  assert.match(result.deliveryProof.deliveryHash, /^[a-f0-9]{64}$/);
});

test("runCrooResearchAgent auto-routes strong onchain prompts", async () => {
  const result = await runCrooResearchAgent(
    {
      topic: "Base chain TVL today",
    },
    {
      onchainExecutors: {
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
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    }
  );

  assert.ok(result.onchain);
  assert.equal(result.onchain.plan.intent.scope, "chain");
});

test("runCrooResearchAgent keeps broad research prompts on research mode", async () => {
  const result = await runCrooResearchAgent(
    {
      topic: "CROO hackathon agent idea",
    },
    {
      providers: [],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    }
  );

  assert.equal(result.onchain, undefined);
  assert.match(result.title, /Protocol Research/);
});

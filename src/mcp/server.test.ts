import assert from "node:assert/strict";
import test from "node:test";

import { createMcpServer, runLangclawCommand } from "./server.js";
import type { ProviderExecutor } from "../core/onchain/providers.js";
import type { OnchainCommandId } from "../core/onchain/types.js";

test("createMcpServer returns a server instance", () => {
  const server = createMcpServer();

  assert.equal(typeof server.connect, "function");
});

test("langclaw_command routes research commands", async () => {
  const result = await runLangclawCommand(
    {
      command: "/langclaw-research",
      query: "CROO agent market fit",
    },
    { providers: [], now: fixedNow }
  );

  assert.equal(result.routedTool, "langclaw_research");
  assert.match(result.markdown, /Protocol Research: CROO agent market fit/);
});

test("langclaw_command routes default langclaw command to research", async () => {
  const result = await runLangclawCommand(
    {
      command: "/langclaw CROO agent market fit",
    },
    { providers: [], now: fixedNow }
  );

  assert.equal(result.routedTool, "langclaw_research");
  assert.match(result.markdown, /CROO agent market fit/);
});

test("langclaw_command routes onchain command without changing chain scope", async () => {
  const result = await runLangclawCommand(
    {
      chain: "base",
      command: "/langclaw-onchain",
      query: "Base chain activity today",
      scope: "chain",
    },
    { onchainExecutors: onchainExecutors(), now: fixedNow }
  );

  assert.equal(result.routedTool, "langclaw_onchain_intelligence");
  assert.match(result.markdown, /Scope: chain/);
  assert.doesNotMatch(result.markdown, /Scope: token/);
});

test("langclaw_command routes verify, builder review, and readiness commands", async () => {
  const verify = await runLangclawCommand(
    {
      command: "/langclaw-verify",
      query: "Langclaw supports hosted MCP",
    },
    { providers: [], now: fixedNow }
  );
  const builder = await runLangclawCommand(
    {
      command: "/langclaw-builder-review",
      program: "CROO",
      query: "Langclaw",
    },
    { providers: [], now: fixedNow }
  );
  const readiness = await runLangclawCommand({ command: "/langclaw-readiness" });

  assert.equal(verify.routedTool, "langclaw_verify_claim");
  assert.match(verify.markdown, /Claim Verification/);
  assert.equal(builder.routedTool, "langclaw_builder_review");
  assert.match(builder.markdown, /Hackathon Fit: Langclaw for CROO/);
  assert.equal(readiness.routedTool, "langclaw_readiness");
  assert.match(readiness.markdown, /checks/);
});

test("langclaw_command returns clear errors for unknown commands and missing query", async () => {
  const unknown = await runLangclawCommand({ command: "/not-langclaw" });
  const missingQuery = await runLangclawCommand({ command: "/langclaw-onchain" });

  assert.match(unknown.markdown, /Unsupported Langclaw command/);
  assert.match(unknown.markdown, /\/langclaw-onchain/);
  assert.match(missingQuery.markdown, /requires a query/);
});

function fixedNow(): Date {
  return new Date("2026-06-24T00:00:00.000Z");
}

function onchainExecutors(): Partial<Record<OnchainCommandId, ProviderExecutor>> {
  return {
    "defillama.chain_tvl": async () => ({
      data: { tvl: 1 },
      sourceUrl: "https://example.test/chain-tvl",
      summary: "Mock chain TVL completed.",
    }),
    "defillama.stablecoins": async () => ({
      data: { stablecoins: 1 },
      sourceUrl: "https://example.test/stablecoins",
      summary: "Mock stablecoins completed.",
    }),
    "dexscreener.latest_profiles": async () => ({
      data: [],
      sourceUrl: "https://example.test/profiles",
      summary: "Mock profiles completed.",
    }),
    "dexscreener.latest_boosts": async () => ({
      data: [],
      sourceUrl: "https://example.test/latest-boosts",
      summary: "Mock latest boosts completed.",
    }),
    "dexscreener.top_boosts": async () => ({
      data: [],
      sourceUrl: "https://example.test/top-boosts",
      summary: "Mock top boosts completed.",
    }),
    "local.synthesis": async () => ({
      data: { done: true },
      summary: "Mock synthesis completed.",
    }),
  };
}

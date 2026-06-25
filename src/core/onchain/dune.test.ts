import assert from "node:assert/strict";
import test from "node:test";

import { buildDuneSmartMoneySql, providerExecutors } from "./providers.js";

const chainIds = [
  ["base", "base"],
  ["ethereum", "ethereum"],
  ["arbitrum", "arbitrum"],
  ["optimism", "optimism"],
  ["polygon", "polygon"],
  ["bnb", "bnb"],
  ["avalanche", "avalanche_c"],
  ["celo", "celo"],
  ["mantle", "mantle"],
] as const;

for (const [chainId, duneChain] of chainIds) {
  test(`Dune SQL builder supports ${chainId}`, () => {
    const built = buildDuneSmartMoneySql({
      chainId,
      query: "smart money accumulation for $TEST last 7 days min 10000",
    });

    assert.match(built.sql, new RegExp(`blockchain = '${duneChain}'`));
    assert.match(built.sql, /amount_usd >= 10000/);
    assert.match(built.sql, /date_add\('day', -7, current_timestamp\)/);
    assert.match(built.sql, /upper\(token_bought_symbol\) = 'TEST'/);
  });
}

test("Dune SQL builder escapes raw prompt text and bounds numbers", () => {
  const built = buildDuneSmartMoneySql({
    chainId: "base",
    query: "smart money for $TES'T;DROP last 99 days min 999999999",
  });

  assert.equal(built.windowDays, 30);
  assert.equal(built.minUsd, 1000000);
  assert.doesNotMatch(built.sql, /DROP/i);
  assert.doesNotMatch(built.sql, /;/);
});

test("Dune dynamic provider executes SQL and reads results", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DUNE_API_KEY;
  const calls: string[] = [];
  process.env.DUNE_API_KEY = "test-key";
  globalThis.fetch = (async (url, init) => {
    const parsed = new URL(String(url));
    calls.push(parsed.pathname);
    if (parsed.pathname === "/api/v1/sql/execute") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { sql?: string };
      assert.match(body.sql ?? "", /dex\.trades/);
      return json({ execution_id: "exec-1" });
    }
    if (parsed.pathname === "/api/v1/execution/exec-1/status") {
      return json({ is_execution_finished: true, execution_cost_credits: 1 });
    }
    if (parsed.pathname === "/api/v1/execution/exec-1/results") {
      return json({ result: { rows: [{ wallet: "0x1", netUsd: 10000 }] } });
    }
    return json({}, 404);
  }) as typeof fetch;

  try {
    const result = await providerExecutors["dune.sql_execute"]({
      chain: {
        aliases: [],
        dexscreenerId: "base",
        geckoterminalId: "base",
        id: "base",
        name: "Base",
        nativeSymbol: "ETH",
      },
      previousSummaries: [],
      query: "smart money accumulation on Base",
    });

    assert.equal(result.routeDebug?.selectedChain, "base");
    assert.equal(result.routeDebug?.tableFamily, "dex.trades");
    assert.deepEqual(calls, [
      "/api/v1/sql/execute",
      "/api/v1/execution/exec-1/status",
      "/api/v1/execution/exec-1/results",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.DUNE_API_KEY = originalKey;
  }
});

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

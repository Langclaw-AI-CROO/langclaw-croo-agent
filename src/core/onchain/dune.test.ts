import assert from "node:assert/strict";
import test from "node:test";

import { buildDuneSmartMoneySql, extractDuneSmartMoneyRows, providerExecutors, readDuneApiKeys } from "./providers.js";

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

test("Dune key resolver reads primary, fallbacks, and deduplicates", () => {
  assert.deepEqual(
    readDuneApiKeys({
      DUNE_API_KEY: "primary",
      DUNE_API_KEYS: "backup, primary, backup-2,backup",
    }),
    ["primary", "backup", "backup-2"]
  );
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

test("Dune dynamic provider falls back to backup key on retryable status", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DUNE_API_KEY;
  const originalKeys = process.env.DUNE_API_KEYS;
  const originalStatuses = process.env.DUNE_API_KEY_RETRY_STATUS;
  const originalMaxAttempts = process.env.DUNE_API_KEY_MAX_ATTEMPTS;
  const seenKeys: string[] = [];
  process.env.DUNE_API_KEY = "primary-key";
  process.env.DUNE_API_KEYS = "backup-key";
  process.env.DUNE_API_KEY_RETRY_STATUS = "429";
  process.env.DUNE_API_KEY_MAX_ATTEMPTS = "2";
  globalThis.fetch = (async (url, init) => {
    const parsed = new URL(String(url));
    seenKeys.push(String((init?.headers as Record<string, string>)["x-dune-api-key"]));
    if (parsed.pathname === "/api/v1/sql/execute" && seenKeys.length === 1) {
      return json({ error: "rate limited" }, 429);
    }
    if (parsed.pathname === "/api/v1/sql/execute") {
      return json({ execution_id: "exec-2" });
    }
    if (parsed.pathname === "/api/v1/execution/exec-2/status") {
      return json({ is_execution_finished: true, execution_cost_credits: 1 });
    }
    if (parsed.pathname === "/api/v1/execution/exec-2/results") {
      return json({ result: { rows: [] } });
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

    assert.deepEqual(seenKeys, ["primary-key", "backup-key", "backup-key", "backup-key"]);
    assert.equal(result.routeDebug?.duneKeyAttemptCount, 4);
    assert.equal(result.routeDebug?.duneKeyFallbackUsed, true);
    assert.doesNotMatch(JSON.stringify(result.routeDebug), /primary-key|backup-key/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.DUNE_API_KEY = originalKey;
    process.env.DUNE_API_KEYS = originalKeys;
    process.env.DUNE_API_KEY_RETRY_STATUS = originalStatuses;
    process.env.DUNE_API_KEY_MAX_ATTEMPTS = originalMaxAttempts;
  }
});

test("Dune dynamic provider does not fall back on non-retryable status", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DUNE_API_KEY;
  const originalKeys = process.env.DUNE_API_KEYS;
  const originalStatuses = process.env.DUNE_API_KEY_RETRY_STATUS;
  const calls: string[] = [];
  process.env.DUNE_API_KEY = "primary-key";
  process.env.DUNE_API_KEYS = "backup-key";
  process.env.DUNE_API_KEY_RETRY_STATUS = "429";
  globalThis.fetch = (async (_url, init) => {
    calls.push(String((init?.headers as Record<string, string>)["x-dune-api-key"]));
    return json({ error: "bad request" }, 400);
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        providerExecutors["dune.sql_execute"]({
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
        }),
      /Dune HTTP 400/
    );
    assert.deepEqual(calls, ["primary-key"]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.DUNE_API_KEY = originalKey;
    process.env.DUNE_API_KEYS = originalKeys;
    process.env.DUNE_API_KEY_RETRY_STATUS = originalStatuses;
  }
});

test("Dune smart-money extractor reads result rows", () => {
  const rows = extractDuneSmartMoneyRows({
    result: {
      rows: [
        {
          dataSource: "Dune dex.trades dynamic SQL",
          netUsd: "12345.67",
          signal: "dex_accumulation_candidate",
          tokenAddress: "0x0000000000000000000000000000000000000001",
          tokenSymbol: "AERO",
          trades: "3",
          wallet: "0x1111111111111111111111111111111111111111",
          window: "2026-06-18 to 2026-06-25",
        },
      ],
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.wallet, "0x1111111111111111111111111111111111111111");
  assert.equal(rows[0]?.tokenSymbol, "AERO");
  assert.equal(rows[0]?.netUsd, 12345.67);
  assert.equal(rows[0]?.trades, 3);
});

test("Dune smart-money extractor reads rows and data fallbacks", () => {
  const row = {
    net_usd: 20000,
    token_bought_address: "0x0000000000000000000000000000000000000002",
    token_symbol: "VIRTUAL",
    trades: 2,
    wallet: "0x2222222222222222222222222222222222222222",
  };

  assert.equal(extractDuneSmartMoneyRows({ rows: [row] }).length, 1);
  assert.equal(extractDuneSmartMoneyRows({ data: [row] }).length, 1);
  assert.equal(extractDuneSmartMoneyRows({ data: { rows: [row] } }).length, 1);
});

test("Dune smart-money extractor drops unusable rows", () => {
  const rows = extractDuneSmartMoneyRows({
    result: {
      rows: [
        { netUsd: 10000, tokenSymbol: "BAD", wallet: "Base" },
        { netUsd: 0, tokenSymbol: "BAD", wallet: "0x3333333333333333333333333333333333333333" },
      ],
    },
  });

  assert.deepEqual(rows, []);
});

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

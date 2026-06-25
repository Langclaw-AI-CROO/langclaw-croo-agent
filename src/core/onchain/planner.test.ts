import assert from "node:assert/strict";
import test from "node:test";

import { parseOnchainIntent } from "./parser.js";
import { planOnchainTools } from "./planner.js";

test("planner blocks token fallback for chain scope", () => {
  const intent = parseOnchainIntent({ query: "Base chain activity today" });
  const plan = planOnchainTools(intent, { query: "Base chain activity today" });

  assert.equal(plan.selectedRoute, "chain");
  assert.ok(plan.blockedFallbacks.some((item) => item.includes("token price")));
  assert.ok(plan.commands.every((command) => command.scopes.includes("chain") || command.id === "local.synthesis"));
});

test("planner returns unsupported status for unsupported chain", () => {
  const intent = parseOnchainIntent({ query: "Monad chain activity today" });
  const plan = planOnchainTools(intent, { query: "Monad chain activity today" });

  assert.equal(plan.debug.finalStatus, "unsupported");
  assert.deepEqual(plan.commands.map((command) => command.id), ["local.synthesis"]);
});

test("planner prioritizes Dune dynamic SQL for smart-money prompts", () => {
  const previousKey = process.env.DUNE_API_KEY;
  process.env.DUNE_API_KEY = "test-key";
  try {
    const input = { query: "smart money accumulation on Base last 7 days" };
    const intent = parseOnchainIntent(input);
    const plan = planOnchainTools(intent, input);

    assert.equal(plan.commands[0]?.id, "dune.sql_execute");
    assert.ok(plan.debug.rejectedCommands.every((item) => !item.includes("DUNE_DEFAULT_QUERY_ID")));
  } finally {
    process.env.DUNE_API_KEY = previousKey;
  }
});

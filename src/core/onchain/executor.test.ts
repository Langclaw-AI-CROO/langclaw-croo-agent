import assert from "node:assert/strict";
import test from "node:test";

import { executeOnchainPlan } from "./executor.js";
import { parseOnchainIntent } from "./parser.js";
import { planOnchainTools } from "./planner.js";

test("executor returns partial failures and local synthesis", async () => {
  const input = {
    query: "Token liquidity on Base",
    tokenAddress: "0x0000000000000000000000000000000000000001",
  };
  const intent = parseOnchainIntent(input);
  const plan = planOnchainTools(intent, input);
  const executors = Object.fromEntries(
    plan.commands.map((command, index) => [
      command.id,
      async () => {
        if (index === 0) {
          throw new Error("mock failure");
        }
        return {
          data: { ok: true },
          sourceUrl: `https://example.test/${command.id}`,
          summary: `${command.title} completed.`,
        };
      },
    ])
  );

  const results = await executeOnchainPlan(plan, { executors });

  assert.equal(results[0]?.status, "failed");
  assert.ok(results.some((result) => result.status === "success"));
});

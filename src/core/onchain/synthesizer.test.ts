import assert from "node:assert/strict";
import test from "node:test";

import { parseOnchainIntent } from "./parser.js";
import { planOnchainTools } from "./planner.js";
import { synthesizeOnchainOutput } from "./synthesizer.js";

test("synthesizer returns markdown with provider trace and caveat", () => {
  const input = { query: "Base chain TVL today" };
  const intent = parseOnchainIntent(input);
  const plan = planOnchainTools(intent, input);
  const output = synthesizeOnchainOutput(plan, [
    {
      commandId: "defillama.chain_tvl",
      title: "Chain TVL",
      provider: "defillama",
      status: "success",
      latencyMs: 1,
      summary: "Fetched chain TVL records.",
      sourceUrl: "https://example.test/tvl",
      data: { ok: true },
    },
  ]);

  assert.equal(output.confidence, "medium");
  assert.match(output.markdown, /Provider Trace/);
  assert.equal(output.sourceUrls[0], "https://example.test/tvl");
});

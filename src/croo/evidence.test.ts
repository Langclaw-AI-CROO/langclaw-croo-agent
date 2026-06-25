import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { appendCrooOrderEvidence, evidenceForDelivery, evidenceForOrder } from "./evidence.js";

test("appendCrooOrderEvidence writes safe JSONL records", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "langclaw-croo-evidence-"));
  const filePath = path.join(tempDir, "orders.jsonl");

  try {
    const order = {
      id: "order-1",
      capabilityId: "langclaw.research.brief" as const,
      serviceId: "svc-1",
      input: {
        topic: "CROO market fit",
        context: "token lc_live_secret and key croo_sk_secret plus sk-proj-secret and sk-secret",
      },
    };

    await appendCrooOrderEvidence(
      evidenceForOrder("order_paid", order, {
        negotiationId: "neg-1",
        orderId: "order-1",
        settlementMode: "escrow",
      }),
      { filePath, now: new Date("2026-06-25T00:00:00.000Z") }
    );

    const [line] = (await readFile(filePath, "utf8")).trim().split("\n");
    const record = JSON.parse(line) as Record<string, unknown>;

    assert.equal(record.stage, "order_paid");
    assert.equal(record.generatedAt, "2026-06-25T00:00:00.000Z");
    assert.equal(record.negotiationId, "neg-1");
    assert.equal(record.orderId, "order-1");
    assert.equal(record.capabilityId, "langclaw.research.brief");
    assert.equal(typeof record.inputHash, "string");
    assert.doesNotMatch(line, /lc_live_secret|croo_sk_secret|sk-proj-secret|sk-secret|CROO market fit/);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("evidenceForDelivery includes proof fields", () => {
  const order = {
    id: "order-2",
    capabilityId: "langclaw.onchain.intelligence" as const,
    input: { topic: "Base activity" },
  };
  const evidence = evidenceForDelivery(order, {
    orderId: "order-2",
    capabilityId: "langclaw.onchain.intelligence",
    status: "delivered",
    result: {
      title: "Base activity",
      summary: "Done",
      recommendation: "Review",
      confidence: "medium",
      sources: [],
      providerTrace: [],
      markdown: "Done",
      deliveryProof: {
        deliveryHash: "hash-1",
        generatedAt: "2026-06-25T00:00:00.000Z",
        inputHash: "input-hash-1",
        sourceCount: 2,
        executionLog: ["completed"],
      },
    },
    proof: {
      deliveryHash: "hash-1",
      generatedAt: "2026-06-25T00:00:00.000Z",
      inputHash: "input-hash-1",
      sourceCount: 2,
    },
  });

  assert.equal(evidence.deliveryHash, "hash-1");
  assert.equal(evidence.sourceCount, 2);
  assert.equal(evidence.stage, "order_delivered");
});

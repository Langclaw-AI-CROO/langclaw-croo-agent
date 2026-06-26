import assert from "node:assert/strict";
import test from "node:test";

import { hireA2AWorkbench } from "./a2a-workbench.js";
import type { ResearchOutput } from "../core/types.js";

test("hireA2AWorkbench creates paid downstream order and returns sanitized work pack", async () => {
  const previousServiceId = process.env.LANGCLAW_A2A_WORKBENCH_SERVICE_ID;
  const previousTimeout = process.env.LANGCLAW_A2A_WORKBENCH_TIMEOUT_MS;
  process.env.LANGCLAW_A2A_WORKBENCH_SERVICE_ID = "svc-workbench";
  process.env.LANGCLAW_A2A_WORKBENCH_TIMEOUT_MS = "100";
  const calls: string[] = [];
  let listCalls = 0;

  try {
    const run = await hireA2AWorkbench({
      client: {
        negotiateOrder: async (request: unknown) => {
          calls.push(`negotiate:${JSON.stringify(request)}`);
          return {
            negotiationId: "neg-workbench-1",
            serviceId: "svc-workbench",
            requesterAgentId: "agent-langclaw",
            providerAgentId: "agent-workbench",
            requirements: "",
            status: "pending",
            rejectReason: "",
            metadata: "",
            expiresAt: "",
            createdTime: "",
            updatedTime: "",
          };
        },
        listOrders: async () => {
          listCalls += 1;
          return [
            {
              orderId: "order-workbench-1",
              negotiationId: "neg-workbench-1",
              chainOrderId: "",
              serviceId: "svc-workbench",
              requesterAgentId: "agent-langclaw",
              providerAgentId: "agent-workbench",
              buyerUserId: "",
              requesterWalletAddress: "0x1111111111111111111111111111111111111111",
              providerWalletAddress: "0x2222222222222222222222222222222222222222",
              price: "100000",
              paymentToken: "USDC",
              deliveryWindow: 900,
              status: listCalls === 1 ? "created" : "completed",
              rejectReason: "",
              createTxHash: "",
              payTxHash: "",
              deliverTxHash: "",
              rejectTxHash: "",
              clearTxHash: "",
              slaDeadline: "",
              payDeadline: "",
              createdTime: "",
              updatedTime: "",
              createdAt: "",
              paidAt: "",
              deliveredAt: "",
              rejectedAt: "",
              expiredAt: "",
            },
          ];
        },
        payOrder: async () => ({
          order: {
            orderId: "order-workbench-1",
            negotiationId: "neg-workbench-1",
            chainOrderId: "",
            serviceId: "svc-workbench",
            requesterAgentId: "agent-langclaw",
            providerAgentId: "agent-workbench",
            buyerUserId: "",
            requesterWalletAddress: "0x1111111111111111111111111111111111111111",
            providerWalletAddress: "0x2222222222222222222222222222222222222222",
            price: "100000",
            paymentToken: "USDC",
            deliveryWindow: 900,
            status: "paid",
            rejectReason: "",
            createTxHash: "",
            payTxHash: "0xpay",
            deliverTxHash: "",
            rejectTxHash: "",
            clearTxHash: "",
            slaDeadline: "",
            payDeadline: "",
            createdTime: "",
            updatedTime: "",
            createdAt: "",
            paidAt: "",
            deliveredAt: "",
            rejectedAt: "",
            expiredAt: "",
          },
          txHash: "0xpay",
        }),
        getDelivery: async () => ({
          deliveryId: "delivery-workbench-1",
          orderId: "order-workbench-1",
          providerAgentId: "agent-workbench",
          deliverableType: "schema",
          deliverableSchema: JSON.stringify({
            summary: "Action pack ready with sk-proj-secret removed.",
            actionSteps: ["Rank candidate wallets"],
            evidenceChecklist: ["Check Dune row evidence"],
            reusePlan: ["Use as agent task context"],
          }),
          deliverableText: "",
          contentHash: "workbench-delivery-hash",
          status: "accepted",
          submittedAt: "",
          verifiedAt: "",
          createdTime: "",
          updatedTime: "",
        }),
      },
      order: {
        id: "langclaw-order-1",
        capabilityId: "langclaw.onchain.intelligence",
        input: {
          topic: "smart money on Base",
          chain: "base",
          timeframe: "7d",
        },
      },
      result: baseResearchOutput(),
    });

    assert.deepEqual(
      run.events.map((event) => event.stage),
      ["a2a_workbench_negotiation_created", "a2a_workbench_order_paid", "a2a_workbench_delivery_received"]
    );
    assert.equal(run.workPack.status, "completed");
    assert.equal(run.workPack.orderId, "order-workbench-1");
    assert.equal(run.workPack.deliveryHash, "workbench-delivery-hash");
    assert.deepEqual(run.workPack.actionSteps, ["Rank candidate wallets"]);
    assert.doesNotMatch(JSON.stringify(run.workPack), /sk-proj-secret/);
    assert.match(calls[0] ?? "", /svc-workbench/);
  } finally {
    restoreEnv("LANGCLAW_A2A_WORKBENCH_SERVICE_ID", previousServiceId);
    restoreEnv("LANGCLAW_A2A_WORKBENCH_TIMEOUT_MS", previousTimeout);
  }
});

function baseResearchOutput(): ResearchOutput {
  return {
    title: "Base smart money",
    summary: "Found candidate flows.",
    recommendation: "Review top wallets.",
    confidence: "medium",
    sources: [
      {
        id: "source-1",
        title: "Dune dex.trades smart-money result",
        url: "https://example.test/dune",
        provider: "onchain",
        excerpt: "Dune rows",
      },
    ],
    providerTrace: [],
    markdown: "Done",
    deliveryProof: {
      deliveryHash: "hash-langclaw",
      generatedAt: "2026-06-25T00:00:00.000Z",
      inputHash: "input-hash-langclaw",
      sourceCount: 1,
      executionLog: ["completed"],
    },
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

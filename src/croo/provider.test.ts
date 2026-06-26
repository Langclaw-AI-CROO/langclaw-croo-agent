import assert from "node:assert/strict";
import test from "node:test";

import { DeliverableType } from "@croo-network/sdk";

import { LicenseStore } from "../license/store.js";
import { acceptNegotiationForSettlement, normalizeOrder, processPaidOrder, reconcileActiveProviderOrders } from "./provider.js";

test("normalizeOrder maps CROO license service id to license capability", () => {
  const order = normalizeOrder({
    orderId: "order-license-service",
    serviceId: "70b7b5d4-961b-47ba-97c6-a863b1c949c0",
    requirements: "{}",
  });

  assert.equal(order.id, "order-license-service");
  assert.equal(order.serviceId, "70b7b5d4-961b-47ba-97c6-a863b1c949c0");
  assert.equal(order.capabilityId, "langclaw.builder.pass.license");
});

test("normalizeOrder maps configured onchain service id to onchain capability", () => {
  const previous = process.env.LANGCLAW_ONCHAIN_SERVICE_ID;
  process.env.LANGCLAW_ONCHAIN_SERVICE_ID = "svc-onchain";

  try {
    const order = normalizeOrder({
      orderId: "order-onchain-service",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        research_prompt: "Find current Base ecosystem signals useful for another agent workflow.",
        chain: "base",
        scope: "chain",
        timeframe: "7d",
        targetUse: "agent-context",
        responseLanguage: "en",
      }),
    });

    assert.equal(order.id, "order-onchain-service");
    assert.equal(order.serviceId, "svc-onchain");
    assert.equal(order.capabilityId, "langclaw.onchain.intelligence");
    assert.equal(order.input.topic, "Find current Base ecosystem signals useful for another agent workflow.");
    assert.equal(order.input.mode, "onchain-intelligence");
    assert.equal(order.input.targetUse, "agent-context");
  } finally {
    if (previous === undefined) {
      delete process.env.LANGCLAW_ONCHAIN_SERVICE_ID;
    } else {
      process.env.LANGCLAW_ONCHAIN_SERVICE_ID = previous;
    }
  }
});

test("normalizeOrder keeps query as backward-compatible onchain prompt alias", () => {
  const order = normalizeOrder({
    orderId: "order-onchain-query-alias",
    requirements: JSON.stringify({
      capabilityId: "langclaw.onchain.intelligence",
      query: "Check Base TVL today.",
    }),
  });

  assert.equal(order.input.topic, "Check Base TVL today.");
  assert.equal(order.input.mode, "onchain-intelligence");
});

test("acceptNegotiationForSettlement uses regular accept for non-fund services", async () => {
  const calls: string[] = [];
  const client = {
    acceptNegotiation: async (negotiationId: string) => {
      calls.push(`accept:${negotiationId}`);
    },
    acceptNegotiationWithFundAddress: async (negotiationId: string, address: string) => {
      calls.push(`fund:${negotiationId}:${address}`);
    },
  };

  await acceptNegotiationForSettlement(client, "neg-1", {});

  assert.deepEqual(calls, ["accept:neg-1"]);
});

test("acceptNegotiationForSettlement treats zero fund amount as non-fund", async () => {
  const calls: string[] = [];
  const client = {
    acceptNegotiation: async (negotiationId: string) => {
      calls.push(`accept:${negotiationId}`);
    },
    acceptNegotiationWithFundAddress: async (negotiationId: string, address: string) => {
      calls.push(`fund:${negotiationId}:${address}`);
    },
  };

  await acceptNegotiationForSettlement(client, "neg-zero", {
    fundAmount: "0",
    fundToken: "0x0000000000000000000000000000000000000000",
  });

  assert.deepEqual(calls, ["accept:neg-zero"]);
});

test("acceptNegotiationForSettlement uses provider fund address for fund-transfer services", async () => {
  const previous = process.env.LANGCLAW_PROVIDER_FUND_ADDRESS;
  process.env.LANGCLAW_PROVIDER_FUND_ADDRESS = "0xF9879b18B280550DDD2fcfb03895B18Acc8fB9b5";
  const calls: string[] = [];
  const client = {
    acceptNegotiation: async (negotiationId: string) => {
      calls.push(`accept:${negotiationId}`);
    },
    acceptNegotiationWithFundAddress: async (negotiationId: string, address: string) => {
      calls.push(`fund:${negotiationId}:${address}`);
    },
  };

  try {
    await acceptNegotiationForSettlement(client, "neg-2", {
      fundAmount: "5000000",
      fundToken: "0x0000000000000000000000000000000000000000",
    });
  } finally {
    if (previous === undefined) {
      delete process.env.LANGCLAW_PROVIDER_FUND_ADDRESS;
    } else {
      process.env.LANGCLAW_PROVIDER_FUND_ADDRESS = previous;
    }
  }

  assert.deepEqual(calls, ["fund:neg-2:0xF9879b18B280550DDD2fcfb03895B18Acc8fB9b5"]);
});

test("acceptNegotiationForSettlement rejects invalid provider fund address", async () => {
  const previous = process.env.LANGCLAW_PROVIDER_FUND_ADDRESS;
  process.env.LANGCLAW_PROVIDER_FUND_ADDRESS = "not-an-address";
  const client = {
    acceptNegotiation: async () => undefined,
    acceptNegotiationWithFundAddress: async () => undefined,
  };

  try {
    await assert.rejects(
      () =>
        acceptNegotiationForSettlement(client, "neg-3", {
          fundAmount: "5000000",
          fundToken: "0x0000000000000000000000000000000000000000",
        }),
      /valid EVM address/
    );
  } finally {
    if (previous === undefined) {
      delete process.env.LANGCLAW_PROVIDER_FUND_ADDRESS;
    } else {
      process.env.LANGCLAW_PROVIDER_FUND_ADDRESS = previous;
    }
  }
});

test("processPaidOrder delivers a paid onchain order after missed websocket event", async () => {
  const deliveries: unknown[] = [];
  const evidence: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-paid-1",
      negotiationId: "neg-paid-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-paid-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "Check Base TVL.",
        chain: "base",
      }),
    },
    deliveries,
  });
  const previous = process.env.LANGCLAW_ONCHAIN_SERVICE_ID;
  const previousA2a = process.env.LANGCLAW_A2A_WORKBENCH_ENABLED;
  process.env.LANGCLAW_ONCHAIN_SERVICE_ID = "svc-onchain";
  process.env.LANGCLAW_A2A_WORKBENCH_ENABLED = "false";

  try {
    await processPaidOrder(client, new Map(), new LicenseStore(), "order-paid-1", {
      evidenceRecorder: async (record) => {
        evidence.push(record);
      },
      researchRunner: async () => ({
        title: "Base TVL",
        summary: "Done",
        recommendation: "Review",
        confidence: "medium" as const,
        sources: [],
        providerTrace: [],
        markdown: "Done",
        deliveryProof: {
          deliveryHash: "delivery-hash-1",
          generatedAt: "2026-06-25T00:00:00.000Z",
          inputHash: "input-hash-1",
          sourceCount: 0,
          executionLog: ["completed"],
        },
      }),
    });
  } finally {
    if (previous === undefined) {
      delete process.env.LANGCLAW_ONCHAIN_SERVICE_ID;
    } else {
      process.env.LANGCLAW_ONCHAIN_SERVICE_ID = previous;
    }
    restoreEnv("LANGCLAW_A2A_WORKBENCH_ENABLED", previousA2a);
  }

  assert.equal(deliveries.length, 1);
  assert.deepEqual(
    evidence.map((record) => (record as { stage: string }).stage),
    ["order_paid", "order_delivered"]
  );
});

test("processPaidOrder includes A2A Workbench work pack for enabled onchain orders", async () => {
  const previousEnabled = process.env.LANGCLAW_A2A_WORKBENCH_ENABLED;
  process.env.LANGCLAW_A2A_WORKBENCH_ENABLED = "true";
  const deliveries: unknown[] = [];
  const evidence: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-a2a-1",
      negotiationId: "neg-a2a-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-a2a-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "smart money on Base",
        chain: "base",
      }),
    },
    deliveries,
  });

  try {
    await processPaidOrder(client, new Map(), new LicenseStore(), "order-a2a-1", {
      a2aWorkbenchRunner: async () => ({
        events: [
          {
            negotiationId: "neg-workbench-1",
            stage: "a2a_workbench_negotiation_created",
          },
          {
            negotiationId: "neg-workbench-1",
            orderId: "order-workbench-1",
            payTxHash: "0xpay",
            stage: "a2a_workbench_order_paid",
          },
          {
            deliveryHash: "workbench-hash",
            negotiationId: "neg-workbench-1",
            orderId: "order-workbench-1",
            stage: "a2a_workbench_delivery_received",
          },
        ],
        workPack: {
          actionSteps: ["Review top wallets"],
          deliveryHash: "workbench-hash",
          evidenceChecklist: ["Check Dune rows"],
          orderId: "order-workbench-1",
          providerAgentId: "0ad53b08-34bf-47a3-870f-5be9eaca0262",
          reusePlan: ["Use as downstream context"],
          serviceId: "a8f1c20d-73f4-4551-856a-32315e18d261",
          status: "completed",
          summary: "Workbench action pack ready.",
        },
      }),
      evidenceRecorder: async (record) => {
        evidence.push(record);
      },
      researchRunner: async () => baseResearchOutput("delivery-hash-a2a"),
    });
  } finally {
    restoreEnv("LANGCLAW_A2A_WORKBENCH_ENABLED", previousEnabled);
  }

  assert.equal(deliveries.length, 1);
  const schema = parseTextDelivery(deliveries[0]);
  assert.equal((schema.a2aWorkPack as { status?: string }).status, "completed");
  assert.equal((schema.a2aWorkPack as { orderId?: string }).orderId, "order-workbench-1");
  assert.deepEqual(
    evidence.map((record) => (record as { stage: string }).stage),
    [
      "order_paid",
      "a2a_workbench_negotiation_created",
      "a2a_workbench_order_paid",
      "a2a_workbench_delivery_received",
      "order_delivered",
    ]
  );
});

test("processPaidOrder keeps onchain delivery when optional Workbench add-on fails", async () => {
  const previousEnabled = process.env.LANGCLAW_A2A_WORKBENCH_ENABLED;
  const previousRequired = process.env.LANGCLAW_A2A_WORKBENCH_REQUIRED;
  process.env.LANGCLAW_A2A_WORKBENCH_ENABLED = "true";
  process.env.LANGCLAW_A2A_WORKBENCH_REQUIRED = "false";
  const deliveries: unknown[] = [];
  const evidence: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-a2a-fallback-1",
      negotiationId: "neg-a2a-fallback-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-a2a-fallback-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "smart money on Base",
      }),
    },
    deliveries,
  });

  try {
    await processPaidOrder(client, new Map(), new LicenseStore(), "order-a2a-fallback-1", {
      a2aWorkbenchRunner: async () => {
        throw new Error("Workbench timeout with sk-proj-secret");
      },
      evidenceRecorder: async (record) => {
        evidence.push(record);
      },
      researchRunner: async () => baseResearchOutput("delivery-hash-a2a-fallback"),
    });
  } finally {
    restoreEnv("LANGCLAW_A2A_WORKBENCH_ENABLED", previousEnabled);
    restoreEnv("LANGCLAW_A2A_WORKBENCH_REQUIRED", previousRequired);
  }

  assert.equal(deliveries.length, 1);
  const schema = parseTextDelivery(deliveries[0]);
  assert.equal("a2aWorkPack" in schema, false);
  assert.doesNotMatch(JSON.stringify(schema), /sk-proj-secret/);
  assert.deepEqual(
    evidence.map((record) => (record as { stage: string }).stage),
    ["order_paid", "a2a_workbench_failed", "order_delivered"]
  );
});

test("processPaidOrder fails onchain delivery when required Workbench add-on fails", async () => {
  const previousEnabled = process.env.LANGCLAW_A2A_WORKBENCH_ENABLED;
  const previousRequired = process.env.LANGCLAW_A2A_WORKBENCH_REQUIRED;
  process.env.LANGCLAW_A2A_WORKBENCH_ENABLED = "true";
  process.env.LANGCLAW_A2A_WORKBENCH_REQUIRED = "true";
  const deliveries: unknown[] = [];
  const evidence: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-a2a-required-1",
      negotiationId: "neg-a2a-required-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-a2a-required-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "smart money on Base",
      }),
    },
    deliveries,
  });

  try {
    await processPaidOrder(client, new Map(), new LicenseStore(), "order-a2a-required-1", {
      a2aWorkbenchRunner: async () => {
        throw new Error("Workbench failed");
      },
      evidenceRecorder: async (record) => {
        evidence.push(record);
      },
      researchRunner: async () => baseResearchOutput("delivery-hash-a2a-required"),
    });
  } finally {
    restoreEnv("LANGCLAW_A2A_WORKBENCH_ENABLED", previousEnabled);
    restoreEnv("LANGCLAW_A2A_WORKBENCH_REQUIRED", previousRequired);
  }

  assert.equal(deliveries.length, 0);
  assert.deepEqual(
    evidence.map((record) => (record as { stage: string }).stage),
    ["order_paid", "a2a_workbench_failed", "order_failed"]
  );
});

test("processPaidOrder does not call A2A Workbench for non-onchain orders", async () => {
  const previousEnabled = process.env.LANGCLAW_A2A_WORKBENCH_ENABLED;
  process.env.LANGCLAW_A2A_WORKBENCH_ENABLED = "true";
  let called = false;
  const deliveries: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-research-1",
      negotiationId: "neg-research-1",
      serviceId: "svc-research",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-research-1",
      serviceId: "svc-research",
      requirements: JSON.stringify({
        capabilityId: "langclaw.research.brief",
        topic: "CROO market fit",
      }),
    },
    deliveries,
  });

  try {
    await processPaidOrder(client, new Map(), new LicenseStore(), "order-research-1", {
      a2aWorkbenchRunner: async () => {
        called = true;
        throw new Error("should not call Workbench");
      },
      evidenceRecorder: async () => undefined,
      researchRunner: async () => baseResearchOutput("delivery-hash-research"),
    });
  } finally {
    restoreEnv("LANGCLAW_A2A_WORKBENCH_ENABLED", previousEnabled);
  }

  assert.equal(called, false);
  assert.equal(deliveries.length, 1);
  const schema = parseTextDelivery(deliveries[0]);
  assert.equal("a2aWorkPack" in schema, false);
});

test("reconcileActiveProviderOrders processes paid orders returned by listOrders", async () => {
  const deliveries: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-reconcile-1",
      negotiationId: "neg-reconcile-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-reconcile-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "Check Base liquidity.",
      }),
    },
    deliveries,
    listedOrders: {
      paid: [
        {
          orderId: "order-reconcile-1",
          negotiationId: "neg-reconcile-1",
          serviceId: "svc-onchain",
          status: "paid",
        },
      ],
    },
  });

  await reconcileActiveProviderOrders(client, new Map(), new LicenseStore(), {
    evidenceRecorder: async () => undefined,
    researchRunner: async () => ({
      title: "Base liquidity",
      summary: "Done",
      recommendation: "Review",
      confidence: "medium" as const,
      sources: [],
      providerTrace: [],
      markdown: "Done",
      deliveryProof: {
        deliveryHash: "delivery-hash-2",
        generatedAt: "2026-06-25T00:00:00.000Z",
        inputHash: "input-hash-2",
        sourceCount: 0,
        executionLog: ["completed"],
      },
    }),
  });

  assert.equal(deliveries.length, 1);
});

test("processPaidOrder does not double deliver duplicate paid events", async () => {
  const deliveries: unknown[] = [];
  let getOrderCalls = 0;
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-duplicate-1",
      negotiationId: "neg-duplicate-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-duplicate-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "Check Base smart money.",
      }),
    },
    deliveries,
    onGetOrder: async () => {
      getOrderCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  });
  const processingOrderIds = new Set<string>();
  const options = {
    evidenceRecorder: async () => undefined,
    processingOrderIds,
    researchRunner: async () => ({
      title: "Base smart money",
      summary: "Done",
      recommendation: "Review",
      confidence: "medium" as const,
      sources: [],
      providerTrace: [],
      markdown: "Done",
      deliveryProof: {
        deliveryHash: "delivery-hash-3",
        generatedAt: "2026-06-25T00:00:00.000Z",
        inputHash: "input-hash-3",
        sourceCount: 0,
        executionLog: ["completed"],
      },
    }),
  };

  await Promise.all([
    processPaidOrder(client, new Map(), new LicenseStore(), "order-duplicate-1", options),
    processPaidOrder(client, new Map(), new LicenseStore(), "order-duplicate-1", options),
  ]);

  assert.equal(getOrderCalls, 1);
  assert.equal(deliveries.length, 1);
});

test("processPaidOrder skips delivering order when delivery is already submitted", async () => {
  const deliveries: unknown[] = [];
  const evidence: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-submitted-1",
      negotiationId: "neg-submitted-1",
      serviceId: "svc-onchain",
      status: "evaluating",
    },
    negotiation: {
      negotiationId: "neg-submitted-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "Check Base.",
      }),
    },
    delivery: {
      deliveryId: "delivery-1",
      orderId: "order-submitted-1",
      status: "submitted",
      contentHash: "hash-existing",
    },
    deliveries,
  });

  await processPaidOrder(client, new Map(), new LicenseStore(), "order-submitted-1", {
    evidenceRecorder: async (record) => {
      evidence.push(record);
    },
    researchRunner: async () => {
      throw new Error("research should not run");
    },
  });

  assert.equal(deliveries.length, 0);
  assert.deepEqual(
    evidence.map((record) => (record as { stage: string }).stage),
    ["order_recovered"]
  );
});

test("processPaidOrder records order_failed when delivery build or submit fails", async () => {
  const evidence: unknown[] = [];
  const client = mockPaidOrderClient({
    order: {
      orderId: "order-failed-1",
      negotiationId: "neg-failed-1",
      serviceId: "svc-onchain",
      status: "paid",
    },
    negotiation: {
      negotiationId: "neg-failed-1",
      serviceId: "svc-onchain",
      requirements: JSON.stringify({
        capabilityId: "langclaw.onchain.intelligence",
        research_prompt: "Check Base.",
      }),
    },
  });

    await processPaidOrder(client, new Map(), new LicenseStore(), "order-failed-1", {
      evidenceRecorder: async (record) => {
        evidence.push(record);
      },
      researchRunner: async () => {
        throw new Error("delivery failed with sk-proj-secret");
      },
    });

  assert.deepEqual(
    evidence.map((record) => (record as { stage: string }).stage),
    ["order_paid", "order_failed"]
  );
});

function mockPaidOrderClient(options: {
  deliveries?: unknown[];
  delivery?: Record<string, unknown>;
  listedOrders?: Record<string, Array<Record<string, unknown>>>;
  negotiation: Record<string, unknown>;
  onGetOrder?: () => Promise<void>;
  order: Record<string, unknown>;
}) {
  const deliveries = options.deliveries ?? [];
  return {
    deliverOrder: async (_orderId: string, request: unknown) => {
      deliveries.push(request);
      return {
        delivery: {
          contentHash: "new-content-hash",
          status: "submitted",
        },
        order: {
          ...options.order,
          status: "delivering",
        },
        txHash: "0xdeliver",
      };
    },
    getDelivery: async () => {
      if (!options.delivery) {
        throw new Error("delivery not found");
      }
      return options.delivery;
    },
    getNegotiation: async () => options.negotiation,
    getOrder: async () => {
      await options.onGetOrder?.();
      return options.order;
    },
    listOrders: async ({ status }: { status?: string }) => options.listedOrders?.[status ?? ""] ?? [],
  } as never;
}

function baseResearchOutput(deliveryHash: string) {
  return {
    title: "Base intelligence",
    summary: "Done",
    recommendation: "Review",
    confidence: "medium" as const,
    sources: [],
    providerTrace: [],
    markdown: "Done",
    deliveryProof: {
      deliveryHash,
      generatedAt: "2026-06-25T00:00:00.000Z",
      inputHash: `${deliveryHash}-input`,
      sourceCount: 0,
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

function parseTextDelivery(delivery: unknown): Record<string, unknown> {
  const request = delivery as { deliverableText?: string; deliverableType?: unknown };
  assert.equal(request.deliverableType, DeliverableType.Text);
  const text = request.deliverableText;
  if (typeof text !== "string") {
    assert.fail("Expected text JSON delivery.");
  }
  return JSON.parse(text) as Record<string, unknown>;
}

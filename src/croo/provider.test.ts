import assert from "node:assert/strict";
import test from "node:test";

import { acceptNegotiationForSettlement, normalizeOrder } from "./provider.js";

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

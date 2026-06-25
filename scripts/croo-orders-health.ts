import "dotenv/config";

import { AgentClient } from "@croo-network/sdk";
import type { Order } from "@croo-network/sdk/dist/types.js";
import { redactSecrets } from "../src/core/redact.js";

type HealthOrder = {
  ageMinutes: number | null;
  createdAt?: string;
  deliveredAt?: string;
  negotiationId: string;
  orderId: string;
  paidAt?: string;
  role: "buyer" | "provider";
  serviceId: string;
  status: string;
  updatedTime?: string;
};

const activeStatuses = ["creating", "created", "paying", "paid", "delivering", "evaluating", "rejecting"];
const failedStatuses = ["create_failed", "pay_failed", "deliver_failed"];
const stalePaidMinutes = readPositiveNumber(process.env.LANGCLAW_CROO_HEALTH_STALE_PAID_MINUTES, 5);

async function main(): Promise<void> {
  const client = new AgentClient(
    {
      baseURL: requiredEnv("CROO_API_URL"),
      wsURL: process.env.CROO_WS_URL,
      logger: { info() {}, warn() {}, error() {}, debug() {} },
    },
    readCrooKey()
  );

  const active: HealthOrder[] = [];
  const failed: HealthOrder[] = [];
  const errors: Array<{ message: string; role: string; status: string }> = [];

  for (const role of ["provider", "buyer"] as const) {
    for (const status of activeStatuses) {
      try {
        active.push(...(await listHealthOrders(client, role, status)));
      } catch (error) {
        errors.push({ role, status, message: errorMessage(error) });
      }
    }
    for (const status of failedStatuses) {
      try {
        failed.push(...(await listHealthOrders(client, role, status)));
      } catch (error) {
        errors.push({ role, status, message: errorMessage(error) });
      }
    }
  }

  const stalePaid = active.filter((order) => order.status === "paid" && (order.ageMinutes ?? 0) > stalePaidMinutes);
  const result = {
    checkedAt: new Date().toISOString(),
    ok: stalePaid.length === 0,
    stalePaidThresholdMinutes: stalePaidMinutes,
    active,
    failed,
    stalePaid,
    errors,
  };

  console.log(JSON.stringify(result, null, 2));
  if (stalePaid.length > 0) {
    process.exitCode = 1;
  }
}

async function listHealthOrders(client: AgentClient, role: "buyer" | "provider", status: string): Promise<HealthOrder[]> {
  const orders = await client.listOrders({ role, status, page: 1, pageSize: 50 });
  return orders.map((order) => compactOrder(order, role));
}

function compactOrder(order: Order, role: "buyer" | "provider"): HealthOrder {
  const createdAt = order.createdAt || order.createdTime || undefined;
  return {
    ageMinutes: createdAt ? Math.round((Date.now() - Date.parse(createdAt)) / 60000) : null,
    createdAt,
    deliveredAt: order.deliveredAt || undefined,
    negotiationId: order.negotiationId,
    orderId: order.orderId,
    paidAt: order.paidAt || undefined,
    role,
    serviceId: order.serviceId,
    status: order.status,
    updatedTime: order.updatedTime || undefined,
  };
}

function readCrooKey(): string {
  return process.env.CROO_SDK_KEY?.trim() || process.env.CROO_API_KEY?.trim() || requiredEnv("CROO_SDK_KEY");
}

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});

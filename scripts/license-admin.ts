import "dotenv/config";

import { LicenseStore } from "../src/license/store.js";
import { hashLicenseToken, redactLicenseToken } from "../src/license/token.js";

const command = process.argv[2];
const flags = readFlags(process.argv.slice(3));
const store = new LicenseStore();

if (command === "create") {
  const label = readStringFlag(flags, "label") ?? "manual";
  const days = readNumberFlag(flags, "days");
  const calls = readNumberFlag(flags, "calls");
  const sourceOrderId = readStringFlag(flags, "source-order-id");
  const result = store.create({
    label,
    days,
    maxCalls: calls,
    sourceOrderId,
  });
  console.log(JSON.stringify(
    {
      token: result.token,
      tokenHash: result.record.tokenHash,
      label: result.record.label,
      issuedAt: result.record.issuedAt,
      expiresAt: result.record.expiresAt,
      maxCalls: result.record.maxCalls,
      usedCalls: result.record.usedCalls,
      status: result.record.status,
    },
    null,
    2
  ));
} else if (command === "list") {
  console.log(JSON.stringify(
    store.list().map((record) => ({
      tokenHash: record.tokenHash,
      label: record.label,
      sourceOrderId: record.sourceOrderId,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      maxCalls: record.maxCalls,
      usedCalls: record.usedCalls,
      status: record.status,
    })),
    null,
    2
  ));
} else if (command === "revoke") {
  const token = readStringFlag(flags, "token");
  const hash = readStringFlag(flags, "token-hash");
  if (!token && !hash) {
    fail("Use --token or --token-hash.");
  }
  const revoked = token ? store.revoke(token) : store.revokeHash(hash!);
  console.log(JSON.stringify({ revoked, token: token ? redactLicenseToken(token) : undefined, tokenHash: hash ?? (token ? hashLicenseToken(token) : undefined) }, null, 2));
} else {
  fail("Usage: license-admin.ts create|list|revoke [--label value] [--days number] [--calls number] [--token value]");
}

function readFlags(args: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) {
      result[key] = inline;
      continue;
    }
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
      continue;
    }
    result[key] = true;
  }
  return result;
}

function readStringFlag(flags: Record<string, string | true>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumberFlag(flags: Record<string, string | true>, key: string): number | undefined {
  const value = readStringFlag(flags, key);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

import fs from "node:fs";
import path from "node:path";

import { generateLicenseToken, hashLicenseToken } from "./token.js";
import type { CreateLicenseInput, CreateLicenseResult, LicenseRecord, LicenseStoreFile, LicenseValidationResult } from "./types.js";

const DEFAULT_DAYS = 30;
const DEFAULT_CALLS = 300;

export type LicenseStoreOptions = {
  defaultCalls?: number;
  defaultDays?: number;
  path?: string;
};

export class LicenseStore {
  private readonly defaultCalls: number;
  private readonly defaultDays: number;
  private readonly storePath: string;

  constructor(options: LicenseStoreOptions = {}) {
    this.storePath = options.path ?? readLicenseStorePath();
    this.defaultDays = options.defaultDays ?? readPositiveEnv("LANGCLAW_LICENSE_DEFAULT_DAYS", DEFAULT_DAYS);
    this.defaultCalls = options.defaultCalls ?? readPositiveEnv("LANGCLAW_LICENSE_DEFAULT_CALLS", DEFAULT_CALLS);
  }

  create(input: CreateLicenseInput): CreateLicenseResult {
    const token = input.token ?? generateLicenseToken();
    const now = input.now ?? new Date();
    const days = positive(input.days, this.defaultDays);
    const maxCalls = positive(input.maxCalls, this.defaultCalls);
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const file = this.read();
    const record: LicenseRecord = {
      createdAt: issuedAt,
      expiresAt,
      issuedAt,
      label: input.label,
      maxCalls,
      sourceOrderId: input.sourceOrderId,
      status: "active",
      tokenHash: hashLicenseToken(token),
      usedCalls: 0,
    };

    file.licenses = file.licenses.filter((item) => item.tokenHash !== record.tokenHash);
    file.licenses.push(record);
    this.write(file);
    return { record, token };
  }

  list(): LicenseRecord[] {
    return [...this.read().licenses].sort((left, right) => left.issuedAt.localeCompare(right.issuedAt));
  }

  revoke(token: string): boolean {
    return this.revokeHash(hashLicenseToken(token));
  }

  revokeHash(tokenHash: string): boolean {
    const file = this.read();
    const record = file.licenses.find((item) => item.tokenHash === tokenHash);
    if (!record) {
      return false;
    }
    record.status = "revoked";
    this.write(file);
    return true;
  }

  validate(token: string, now = new Date()): LicenseValidationResult {
    const tokenHash = hashLicenseToken(token);
    const file = this.read();
    const record = file.licenses.find((item) => item.tokenHash === tokenHash);
    if (!record) {
      return { ok: false, reason: "invalid" };
    }
    if (record.status !== "active") {
      return { ok: false, reason: "revoked", record };
    }
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: "expired", record };
    }
    return { ok: true, record };
  }

  validateAndConsume(token: string, now = new Date(), calls = 1): LicenseValidationResult {
    const tokenHash = hashLicenseToken(token);
    const file = this.read();
    const record = file.licenses.find((item) => item.tokenHash === tokenHash);
    if (!record) {
      return { ok: false, reason: "invalid" };
    }
    if (record.status !== "active") {
      return { ok: false, reason: "revoked", record };
    }
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: "expired", record };
    }
    const callCount = Math.max(1, Math.floor(calls));
    if (record.usedCalls + callCount > record.maxCalls) {
      return { ok: false, reason: "over_limit", record };
    }
    record.usedCalls += callCount;
    this.write(file);
    return { ok: true, record };
  }

  private read(): LicenseStoreFile {
    if (!fs.existsSync(this.storePath)) {
      return { licenses: [], version: 1 };
    }
    const parsed = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as Partial<LicenseStoreFile>;
    return {
      licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
      version: 1,
    };
  }

  private write(file: LicenseStoreFile): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tmpPath = `${this.storePath}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(file, null, 2)}\n`);
    fs.renameSync(tmpPath, this.storePath);
  }
}

export function readLicenseStorePath(): string {
  return process.env.LANGCLAW_LICENSE_STORE_PATH?.trim() || path.resolve("data", "licenses.json");
}

function readPositiveEnv(name: string, fallback: number): number {
  return positive(Number.parseInt(process.env[name] ?? "", 10), fallback);
}

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

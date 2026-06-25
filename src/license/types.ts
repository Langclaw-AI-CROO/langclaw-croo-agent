export type LicenseStatus = "active" | "revoked";

export type LicenseRecord = {
  createdAt: string;
  expiresAt: string;
  issuedAt: string;
  label: string;
  maxCalls: number;
  sourceOrderId?: string;
  status: LicenseStatus;
  tokenHash: string;
  usedCalls: number;
};

export type LicenseStoreFile = {
  licenses: LicenseRecord[];
  version: 1;
};

export type CreateLicenseInput = {
  days?: number;
  label: string;
  maxCalls?: number;
  now?: Date;
  sourceOrderId?: string;
  token?: string;
};

export type CreateLicenseResult = {
  record: LicenseRecord;
  token: string;
};

export type LicenseValidationResult =
  | { ok: true; record: LicenseRecord }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "over_limit"; record?: LicenseRecord };

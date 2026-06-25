import { createHash, randomBytes } from "node:crypto";

export function generateLicenseToken(prefix = "lc_live"): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function hashLicenseToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function redactLicenseToken(token: string): string {
  if (token.length <= 12) {
    return "[redacted]";
  }
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

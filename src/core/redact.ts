const secretPatterns: Array<[RegExp, string]> = [
  [/sk-proj-[A-Za-z0-9_-]+/g, "sk-proj-[redacted]"],
  [/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]"],
  [/croo_sk_[A-Za-z0-9]+/g, "croo_sk_[redacted]"],
  [/lc_live_[A-Za-z0-9_-]+/g, "lc_live_[redacted]"],
];

export function redactSecrets(value: string): string {
  return secretPatterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecrets(value);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return JSON.parse(redactSecrets(JSON.stringify(value))) as unknown;
}

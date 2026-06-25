import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LicenseStore } from "./store.js";
import { hashLicenseToken } from "./token.js";

test("license store creates hashed token records and validates usage", () => {
  const store = makeStore();
  const created = store.create({
    label: "demo",
    days: 7,
    maxCalls: 2,
    now: new Date("2026-06-24T00:00:00.000Z"),
    token: "lc_live_test_token",
  });

  assert.equal(created.token, "lc_live_test_token");
  assert.equal(created.record.tokenHash, hashLicenseToken("lc_live_test_token"));
  assert.doesNotMatch(JSON.stringify(store.list()), /lc_live_test_token/);

  const first = store.validateAndConsume("lc_live_test_token", new Date("2026-06-25T00:00:00.000Z"));
  assert.equal(first.ok, true);
  const second = store.validateAndConsume("lc_live_test_token", new Date("2026-06-25T00:00:00.000Z"));
  assert.equal(second.ok, true);
  const third = store.validateAndConsume("lc_live_test_token", new Date("2026-06-25T00:00:00.000Z"));
  assert.equal(third.ok, false);
  if (!third.ok) {
    assert.equal(third.reason, "over_limit");
  }
});

test("license store rejects expired and revoked tokens", () => {
  const store = makeStore();
  store.create({
    label: "expired",
    days: 1,
    maxCalls: 10,
    now: new Date("2026-06-24T00:00:00.000Z"),
    token: "lc_live_expired",
  });
  const expired = store.validateAndConsume("lc_live_expired", new Date("2026-06-26T00:00:00.000Z"));
  assert.equal(expired.ok, false);
  if (!expired.ok) {
    assert.equal(expired.reason, "expired");
  }

  store.create({
    label: "revoked",
    days: 30,
    maxCalls: 10,
    token: "lc_live_revoked",
  });
  assert.equal(store.revoke("lc_live_revoked"), true);
  const revoked = store.validateAndConsume("lc_live_revoked");
  assert.equal(revoked.ok, false);
  if (!revoked.ok) {
    assert.equal(revoked.reason, "revoked");
  }
});

function makeStore(): LicenseStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "langclaw-license-test-"));
  return new LicenseStore({ path: path.join(dir, "licenses.json") });
}

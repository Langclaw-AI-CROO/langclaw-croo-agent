import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { LicenseStore } from "../license/store.js";
import { createHostedHttpServer } from "./http.js";

test("hosted server exposes health, readiness, and tools without leaking secrets", async () => {
  const previousKey = process.env.CROO_API_KEY;
  process.env.CROO_API_KEY = "secret-croo-key";
  const { baseUrl, close } = await listen(createHostedHttpServer({ accessTokens: ["test-token"] }));

  try {
    const health = await fetchJson(`${baseUrl}/health`);
    assert.equal(health.status, "ok");

    const readinessResponse = await fetch(`${baseUrl}/readiness`);
    const readinessText = await readinessResponse.text();
    assert.equal(readinessResponse.status, 200);
    assert.doesNotMatch(readinessText, /secret-croo-key/);

    const tools = await fetchJson(`${baseUrl}/tools`);
    assert.ok(Array.isArray(tools.tools));
    assert.ok(JSON.stringify(tools).includes("langclaw_builder_review"));
  } finally {
    await close();
    if (previousKey === undefined) {
      delete process.env.CROO_API_KEY;
    } else {
      process.env.CROO_API_KEY = previousKey;
    }
  }
});

test("hosted MCP rejects missing and invalid tokens", async () => {
  const { baseUrl, close } = await listen(createHostedHttpServer({ accessTokens: ["test-token"] }));

  try {
    const missing = await postMcp(baseUrl);
    assert.equal(missing.status, 401);

    const invalid = await postMcp(baseUrl, "wrong-token");
    assert.equal(invalid.status, 403);
  } finally {
    await close();
  }
});

test("hosted MCP accepts a valid token and exposes langclaw tools", async () => {
  const { baseUrl, close } = await listen(createHostedHttpServer({ accessTokens: ["test-token"] }));
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: {
      headers: {
        authorization: "Bearer test-token",
      },
    },
  });
  const client = new Client({ name: "langclaw-test", version: "0.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "langclaw_builder_review"));
    assert.ok(tools.tools.some((tool) => tool.name === "langclaw_onchain_intelligence"));
  } finally {
    await client.close();
    await close();
  }
});

test("hosted MCP accepts license tokens and only increments usage for tool calls", async () => {
  const store = makeLicenseStore();
  const license = store.create({
    label: "test-license",
    maxCalls: 2,
    token: "lc_live_http_valid",
  });
  const { baseUrl, close } = await listen(createHostedHttpServer({ accessTokens: [], licenseStore: store }));

  try {
    const accepted = await postMcp(baseUrl, license.token);
    assert.equal(accepted.status, 200);
    assert.equal(store.list()[0]?.usedCalls, 0);

    const toolCall = await postMcpToolCall(baseUrl, license.token);
    assert.equal(toolCall.status, 200);
    assert.equal(store.list()[0]?.usedCalls, 1);
  } finally {
    await close();
  }
});

test("hosted MCP rejects expired, revoked, and over-limit license tokens", async () => {
  const store = makeLicenseStore();
  const expired = store.create({
    label: "expired",
    days: 1,
    now: new Date("2020-01-01T00:00:00.000Z"),
    token: "lc_live_http_expired",
  });
  const revoked = store.create({ label: "revoked", token: "lc_live_http_revoked" });
  store.revoke(revoked.token);
  const overLimit = store.create({ label: "limit", maxCalls: 1, token: "lc_live_http_limit" });
  store.validateAndConsume(overLimit.token);
  const { baseUrl, close } = await listen(createHostedHttpServer({ accessTokens: [], licenseStore: store }));

  try {
    assert.equal((await postMcp(baseUrl, expired.token)).status, 403);
    assert.equal((await postMcp(baseUrl, revoked.token)).status, 403);
    assert.equal((await postMcp(baseUrl, overLimit.token)).status, 200);
    assert.equal((await postMcpToolCall(baseUrl, overLimit.token)).status, 429);
  } finally {
    await close();
  }
});

async function listen(server: Server): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json() as Promise<Record<string, unknown>>;
}

async function postMcp(baseUrl: string, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      },
    }),
  });
}

async function postMcpToolCall(baseUrl: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "langclaw_readiness",
        arguments: {},
      },
    }),
  });
}

function makeLicenseStore(): LicenseStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "langclaw-http-license-"));
  return new LicenseStore({ path: path.join(dir, "licenses.json") });
}

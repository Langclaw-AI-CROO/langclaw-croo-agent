import assert from "node:assert/strict";
import test from "node:test";

import { buildCapabilities, buildCapability, buildDelivery, buildLicenseDelivery, formatLicenseDeliveryText } from "./delivery.js";
import type { ResearchOutput } from "../core/types.js";

test("buildCapability exposes the paid research brief capability", () => {
  const capability = buildCapability();

  assert.equal(capability.id, "langclaw.research.brief");
  assert.equal(capability.inputSchema.type, "object");
});

test("buildCapabilities exposes the license pass capability", () => {
  const capabilities = buildCapabilities();

  assert.ok(capabilities.some((capability) => capability.id === "langclaw.builder.pass.license"));
});

test("buildDelivery maps research output to CROO delivery payload", () => {
  const result: ResearchOutput = {
    title: "Title",
    summary: "Summary",
    recommendation: "Recommendation",
    confidence: "medium",
    sources: [],
    providerTrace: [],
    markdown: "# Title",
    deliveryProof: {
      deliveryHash: "abc",
      generatedAt: "2026-06-24T00:00:00.000Z",
      inputHash: "def",
      sourceCount: 0,
      executionLog: [],
    },
  };

  const delivery = buildDelivery(
    {
      id: "order-1",
      input: { topic: "CROO" },
    },
    result
  );

  assert.equal(delivery.orderId, "order-1");
  assert.equal(delivery.capabilityId, "langclaw.research.brief");
  assert.equal(delivery.proof.deliveryHash, "abc");
});

test("buildLicenseDelivery returns install command and license metadata", () => {
  const delivery = buildLicenseDelivery(
    "order-license-1",
    {
      token: "lc_live_test",
      record: {
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-07-24T00:00:00.000Z",
        issuedAt: "2026-06-24T00:00:00.000Z",
        label: "buyer",
        maxCalls: 300,
        status: "active",
        tokenHash: "hash",
        usedCalls: 0,
      },
    },
    "https://langclaw.nanta.tech"
  );

  assert.equal(delivery.capabilityId, "langclaw.builder.pass.license");
  assert.equal(delivery.license.expiresAt, "2026-07-24T00:00:00.000Z");
  assert.match(delivery.install.codex, /lc_live_test/);
  assert.match(delivery.install.codex, /https:\/\/langclaw\.nanta\.tech\/mcp/);
  assert.equal(delivery.install.oneLineCommands.codex, delivery.install.codex);
  assert.match(delivery.install.oneLineCommands.codexNoPlugin, /--no-plugin/);
  assert.match(delivery.install.oneLineCommands.claudeCode, /install-claude/);
  assert.match(delivery.install.oneLineCommands.cursor, /install-cursor/);
  assert.match(delivery.install.oneLineCommands.windsurf, /install-windsurf/);
  assert.match(delivery.install.oneLineCommands.genericMcpProxy, /^npx @langclaw\/mcp-client --url/);
  assert.match(delivery.install.oneLineCommands.printCodexConfig, /print-codex-config/);
  assert.match(delivery.install.oneLineCommands.printMcpConfig, /print-mcp-config/);
  assert.equal(delivery.install.oneLineCommands.uninstallCodex, "npx @langclaw/mcp-client uninstall-codex");
  assert.match(JSON.stringify(delivery.install.oneLineCommands), /lc_live_test/);
  assert.ok(delivery.service.includedTools.includes("langclaw_onchain_intelligence"));
  assert.doesNotMatch(JSON.stringify(delivery), /TAVILY|DUNE|ALCHEMY|CROO_API_KEY/);
});

test("formatLicenseDeliveryText returns readable buyer instructions", () => {
  const delivery = buildLicenseDelivery(
    "order-license-1",
    {
      token: "lc_live_test",
      record: {
        createdAt: "2026-06-24T00:00:00.000Z",
        expiresAt: "2026-07-24T00:00:00.000Z",
        issuedAt: "2026-06-24T00:00:00.000Z",
        label: "buyer",
        maxCalls: 300,
        status: "active",
        tokenHash: "hash",
        usedCalls: 0,
      },
    },
    "https://langclaw.nanta.tech"
  );

  const text = formatLicenseDeliveryText(delivery);

  assert.match(text, /^# Langclaw Builder Pass License/);
  assert.match(text, /lc_live_test/);
  assert.match(text, /2026-07-24T00:00:00.000Z/);
  assert.match(text, /300 MCP tool calls/);
  assert.match(text, /install-codex/);
  assert.match(text, /install-claude/);
  assert.match(text, /install-cursor/);
  assert.match(text, /install-windsurf/);
  assert.match(text, /Try These Commands in Codex/);
  assert.match(text, /\/langclaw-onchain Base smart money last 7 days/);
  assert.match(text, /\/langclaw-readiness/);
  assert.match(text, /langclaw_onchain_intelligence/);
  assert.doesNotMatch(text, /Generic MCP Proxy/);
  assert.doesNotMatch(text, /print-mcp-config/);
  assert.doesNotMatch(text, /## Full JSON Payload/);
  assert.doesNotMatch(text, /TAVILY|DUNE|ALCHEMY|CROO_API_KEY/);
});

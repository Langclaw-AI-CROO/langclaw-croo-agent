import assert from "node:assert/strict";
import test from "node:test";

import { helpText, parseClientOptions, redactErrorMessage, validateClientOptions } from "./config.js";

test("client parses CLI flags", () => {
  const options = parseClientOptions(["--url", "https://example.test/mcp", "--token", "abc", "--timeout-ms", "1000"], {});

  assert.equal(options.command, "proxy");
  assert.equal(options.url, "https://example.test/mcp");
  assert.equal(options.token, "abc");
  assert.equal(options.timeoutMs, 1000);
  assert.equal(options.installPlugin, true);
  assert.deepEqual(validateClientOptions(options), []);
});

test("client parses installer commands", () => {
  const install = parseClientOptions(["install-codex", "--url", "https://example.test/mcp", "--token", "abc"], {});
  const installClaude = parseClientOptions(["install-claude", "--url", "https://example.test/mcp", "--token", "abc"], {});
  const installCursor = parseClientOptions(["install-cursor", "--url", "https://example.test/mcp", "--token", "abc"], {});
  const installWindsurf = parseClientOptions(["install-windsurf", "--url", "https://example.test/mcp", "--token", "abc"], {});
  const print = parseClientOptions(["print-codex-config", "--url", "https://example.test/mcp", "--token", "abc"], {});
  const printMcp = parseClientOptions(["print-mcp-config", "--url", "https://example.test/mcp", "--token", "abc"], {});
  const uninstall = parseClientOptions(["uninstall-codex"], {});
  const uninstallClaude = parseClientOptions(["uninstall-claude"], {});
  const uninstallCursor = parseClientOptions(["uninstall-cursor"], {});
  const uninstallWindsurf = parseClientOptions(["uninstall-windsurf"], {});
  const noPlugin = parseClientOptions(["install-codex", "--url", "https://example.test/mcp", "--token", "abc", "--no-plugin"], {});

  assert.equal(install.command, "install-codex");
  assert.equal(installClaude.command, "install-claude");
  assert.equal(installCursor.command, "install-cursor");
  assert.equal(installWindsurf.command, "install-windsurf");
  assert.equal(print.command, "print-codex-config");
  assert.equal(printMcp.command, "print-mcp-config");
  assert.equal(uninstall.command, "uninstall-codex");
  assert.equal(uninstallClaude.command, "uninstall-claude");
  assert.equal(uninstallCursor.command, "uninstall-cursor");
  assert.equal(uninstallWindsurf.command, "uninstall-windsurf");
  assert.equal(noPlugin.installPlugin, false);
  assert.deepEqual(validateClientOptions(uninstall), []);
  assert.deepEqual(validateClientOptions(uninstallClaude), []);
  assert.deepEqual(validateClientOptions(uninstallCursor), []);
  assert.deepEqual(validateClientOptions(uninstallWindsurf), []);
});

test("client reads environment fallback", () => {
  const options = parseClientOptions([], {
    LANGCLAW_REMOTE_URL: "https://example.test/mcp",
    LANGCLAW_ACCESS_TOKEN: "env-token",
  });

  assert.equal(options.url, "https://example.test/mcp");
  assert.equal(options.token, "env-token");
});

test("client validates required options and prints help", () => {
  assert.ok(helpText().includes("@langclaw/mcp-client"));
  assert.ok(helpText().includes("install-codex"));
  assert.deepEqual(validateClientOptions(parseClientOptions([], {})), [
    "Missing --url or LANGCLAW_REMOTE_URL.",
    "Missing --token or LANGCLAW_ACCESS_TOKEN.",
  ]);
});

test("client redacts bearer tokens from errors", () => {
  const redacted = redactErrorMessage(new Error("HTTP failed Bearer secret-token-123 --token lc_live_secret123"));
  assert.equal(redacted, "HTTP failed Bearer [redacted] --token [redacted]");
});

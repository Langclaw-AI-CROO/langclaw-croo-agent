import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendLangclawConfig,
  generateClaudeServerJson,
  generateCodexMcpToml,
  generateMcpConfigJson,
  generatePluginMcpJson,
  installCodex,
  installJsonMcpClient,
  removeLangclawConfig,
  uninstallCodex,
  uninstallJsonMcpClient,
} from "./installer.js";

test("installer generates Codex MCP TOML", () => {
  const toml = generateCodexMcpToml("http://127.0.0.1/mcp", "token-1");

  assert.match(toml, /\[mcp_servers\.langclaw\]/);
  assert.match(toml, /"@langclaw\/mcp-client"/);
  assert.match(toml, /"http:\/\/127\.0\.0\.1\/mcp"/);
  assert.match(toml, /"token-1"/);
});

test("installer replaces only existing Langclaw config block", () => {
  const input = [
    'model = "gpt-5"',
    "",
    "[mcp_servers.other]",
    'command = "node"',
    "",
    "[mcp_servers.langclaw]",
    'command = "old"',
    'args = ["old"]',
    "",
    "[projects.\"/tmp\"]",
    'trust_level = "trusted"',
    "",
  ].join("\n");

  const result = appendLangclawConfig(input, "http://example.test/mcp", "token-2");

  assert.match(result, /\[mcp_servers\.other\]/);
  assert.match(result, /\[projects\."\/tmp"\]/);
  assert.doesNotMatch(result, /command = "old"/);
  assert.match(result, /"http:\/\/example\.test\/mcp"/);
});

test("installer removes quoted and plain Langclaw config blocks", () => {
  const result = removeLangclawConfig(
    [
      "[mcp_servers.\"langclaw\"]",
      'command = "old"',
      "[mcp_servers.keep]",
      'command = "keep"',
      "[mcp_servers.langclaw]",
      'command = "old-again"',
      "[projects.\"/tmp\"]",
      'trust_level = "trusted"',
    ].join("\n")
  );

  assert.doesNotMatch(result, /old/);
  assert.match(result, /\[mcp_servers\.keep\]/);
  assert.match(result, /\[projects\."\/tmp"\]/);
});

test("installer writes config, skill, plugin, and backup", () => {
  const codexHome = makeTempCodexHome();
  const configPath = path.join(codexHome, "config.toml");
  fs.writeFileSync(configPath, 'model = "gpt-5"\n');

  const result = installCodex({
    codexHome,
    installPlugin: true,
    now: new Date(2026, 5, 24, 0, 0, 0),
    token: "token-3",
    url: "https://langclaw.nanta.tech/mcp",
  });

  assert.equal(result.configPath, configPath);
  assert.ok(result.backupPath?.endsWith("backup-langclaw-20260624000000"));
  assert.ok(fs.existsSync(result.backupPath ?? ""));
  assert.match(fs.readFileSync(configPath, "utf8"), /\[mcp_servers\.langclaw\]/);
  assert.ok(fs.existsSync(path.join(codexHome, "skills", "langclaw-croo-agent", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(codexHome, "plugins", "langclaw-croo-agent", ".codex-plugin", "plugin.json")));

  const pluginMcp = fs.readFileSync(path.join(codexHome, "plugins", "langclaw-croo-agent", ".mcp.json"), "utf8");
  assert.match(pluginMcp, /https:\/\/langclaw\.nanta\.tech\/mcp/);
  assert.match(pluginMcp, /token-3/);
});

test("installer supports no-plugin mode", () => {
  const codexHome = makeTempCodexHome();

  installCodex({
    codexHome,
    installPlugin: false,
    token: "token-4",
    url: "https://langclaw.nanta.tech/mcp",
  });

  assert.ok(fs.existsSync(path.join(codexHome, "skills", "langclaw-croo-agent", "SKILL.md")));
  assert.equal(fs.existsSync(path.join(codexHome, "plugins", "langclaw-croo-agent")), false);
});

test("uninstall removes Langclaw config, skill, and plugin", () => {
  const codexHome = makeTempCodexHome();
  installCodex({
    codexHome,
    installPlugin: true,
    token: "token-5",
    url: "https://langclaw.nanta.tech/mcp",
  });

  const result = uninstallCodex(codexHome);

  assert.equal(result.removedSkill, true);
  assert.equal(result.removedPlugin, true);
  assert.doesNotMatch(fs.readFileSync(path.join(codexHome, "config.toml"), "utf8"), /langclaw/);
  assert.equal(fs.existsSync(path.join(codexHome, "skills", "langclaw-croo-agent")), false);
  assert.equal(fs.existsSync(path.join(codexHome, "plugins", "langclaw-croo-agent")), false);
});

test("plugin MCP JSON generator points to hosted client", () => {
  const parsed = JSON.parse(generatePluginMcpJson("http://example.test/mcp", "token-6")) as {
    mcpServers: { langclaw: { args: string[]; command: string } };
  };

  assert.equal(parsed.mcpServers.langclaw.command, "npx");
  assert.deepEqual(parsed.mcpServers.langclaw.args, [
    "@langclaw/mcp-client",
    "--url",
    "http://example.test/mcp",
    "--token",
    "token-6",
  ]);
});

test("generic MCP JSON generator points to hosted client", () => {
  const parsed = JSON.parse(generateMcpConfigJson("http://example.test/mcp", "token-7")) as {
    mcpServers: { langclaw: { args: string[]; command: string } };
  };

  assert.equal(parsed.mcpServers.langclaw.command, "npx");
  assert.deepEqual(parsed.mcpServers.langclaw.args, [
    "@langclaw/mcp-client",
    "--url",
    "http://example.test/mcp",
    "--token",
    "token-7",
  ]);
});

test("Claude server JSON generator returns a server definition", () => {
  const parsed = JSON.parse(generateClaudeServerJson("http://example.test/mcp", "token-8")) as {
    args: string[];
    command: string;
  };

  assert.equal(parsed.command, "npx");
  assert.deepEqual(parsed.args, ["@langclaw/mcp-client", "--url", "http://example.test/mcp", "--token", "token-8"]);
});

test("JSON MCP installer merges and uninstalls Langclaw server", () => {
  const configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "langclaw-json-mcp-")), "mcp.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        mcpServers: {
          other: {
            command: "node",
            args: ["server.js"],
          },
        },
      },
      null,
      2
    )
  );

  const installResult = installJsonMcpClient("cursor", {
    configPath,
    now: new Date(2026, 5, 24, 0, 0, 0),
    token: "token-9",
    url: "http://example.test/mcp",
  });
  const installed = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    mcpServers: Record<string, { args: string[]; command: string }>;
  };

  assert.ok(installResult.backupPath?.endsWith("backup-langclaw-20260624000000"));
  assert.equal(installed.mcpServers.other.command, "node");
  assert.equal(installed.mcpServers.langclaw.command, "npx");
  assert.deepEqual(installed.mcpServers.langclaw.args, ["@langclaw/mcp-client", "--url", "http://example.test/mcp", "--token", "token-9"]);

  const uninstallResult = uninstallJsonMcpClient("cursor", configPath);
  const uninstalled = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    mcpServers: Record<string, unknown>;
  };

  assert.equal(uninstallResult.removed, true);
  assert.ok(uninstalled.mcpServers.other);
  assert.equal(uninstalled.mcpServers.langclaw, undefined);
});

function makeTempCodexHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "langclaw-codex-home-"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export type CodexInstallOptions = {
  codexHome?: string;
  installPlugin: boolean;
  now?: Date;
  token: string;
  url: string;
};

export type CodexInstallResult = {
  backupPath?: string;
  configPath: string;
  pluginPath?: string;
  skillPath: string;
};

export type JsonMcpClient = "cursor" | "windsurf";

export type JsonMcpInstallOptions = {
  configPath?: string;
  now?: Date;
  token: string;
  url: string;
};

export type JsonMcpInstallResult = {
  backupPath?: string;
  configPath: string;
};

export type ClaudeInstallResult = {
  command: string;
  installed: boolean;
  message: string;
};

export function generateCodexMcpToml(url: string, token: string): string {
  return [
    "[mcp_servers.langclaw]",
    'command = "npx"',
    "args = [",
    '  "@langclaw/mcp-client",',
    '  "--url",',
    `  ${tomlString(url)},`,
    '  "--token",',
    `  ${tomlString(token)}`,
    "]",
    "",
  ].join("\n");
}

export function generatePluginMcpJson(url: string, token: string): string {
  return `${JSON.stringify(
    generateMcpConfig(url, token),
    null,
    2
  )}\n`;
}

export function generateMcpConfig(url: string, token: string): { mcpServers: { langclaw: { args: string[]; command: "npx" } } } {
  return {
    mcpServers: {
      langclaw: mcpServerDefinition(url, token),
    },
  };
}

export function generateMcpConfigJson(url: string, token: string): string {
  return `${JSON.stringify(generateMcpConfig(url, token), null, 2)}\n`;
}

export function generateClaudeServerJson(url: string, token: string): string {
  return JSON.stringify(mcpServerDefinition(url, token));
}

export function installClaude(url: string, token: string): ClaudeInstallResult {
  const serverJson = generateClaudeServerJson(url, token);
  const result = spawnSync("claude", ["mcp", "add-json", "--scope", "user", "langclaw", serverJson], {
    encoding: "utf8",
  });

  const command = `claude mcp add-json --scope user langclaw '${serverJson}'`;
  if (result.error) {
    return {
      command,
      installed: false,
      message: `Claude Code CLI was not found or could not run. Add this manually:\n${command}`,
    };
  }
  if (result.status !== 0) {
    return {
      command,
      installed: false,
      message: result.stderr?.trim() || result.stdout?.trim() || "Claude Code CLI rejected the MCP config.",
    };
  }
  return {
    command,
    installed: true,
    message: result.stdout?.trim() || "Installed Langclaw into Claude Code CLI.",
  };
}

export function uninstallClaude(): ClaudeInstallResult {
  const result = spawnSync("claude", ["mcp", "remove", "--scope", "user", "langclaw"], {
    encoding: "utf8",
  });
  const command = "claude mcp remove --scope user langclaw";
  if (result.error) {
    return {
      command,
      installed: false,
      message: `Claude Code CLI was not found or could not run. Remove manually if configured: ${command}`,
    };
  }
  return {
    command,
    installed: result.status === 0,
    message: result.stdout?.trim() || result.stderr?.trim() || "Claude Code CLI command completed.",
  };
}

export function installCodex(options: CodexInstallOptions): CodexInstallResult {
  const codexHome = resolveCodexHome(options.codexHome);
  const configPath = path.join(codexHome, "config.toml");
  const skillPath = path.join(codexHome, "skills", "langclaw-croo-agent", "SKILL.md");
  const pluginPath = path.join(codexHome, "plugins", "langclaw-croo-agent");
  const backupPath = backupConfig(configPath, options.now);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const currentConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  fs.writeFileSync(configPath, appendLangclawConfig(currentConfig, options.url, options.token));

  installSkill(skillPath);
  if (options.installPlugin) {
    installPlugin(pluginPath, options.url, options.token);
  } else if (fs.existsSync(pluginPath)) {
    fs.rmSync(pluginPath, { force: true, recursive: true });
  }

  return {
    backupPath,
    configPath,
    pluginPath: options.installPlugin ? pluginPath : undefined,
    skillPath,
  };
}

export function uninstallCodex(codexHomeInput?: string): { configPath: string; removedPlugin: boolean; removedSkill: boolean } {
  const codexHome = resolveCodexHome(codexHomeInput);
  const configPath = path.join(codexHome, "config.toml");
  const skillDir = path.join(codexHome, "skills", "langclaw-croo-agent");
  const pluginDir = path.join(codexHome, "plugins", "langclaw-croo-agent");

  if (fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, removeLangclawConfig(fs.readFileSync(configPath, "utf8")));
  }
  const removedSkill = fs.existsSync(skillDir);
  const removedPlugin = fs.existsSync(pluginDir);
  fs.rmSync(skillDir, { force: true, recursive: true });
  fs.rmSync(pluginDir, { force: true, recursive: true });

  return { configPath, removedPlugin, removedSkill };
}

export function installJsonMcpClient(client: JsonMcpClient, options: JsonMcpInstallOptions): JsonMcpInstallResult {
  const configPath = options.configPath ?? defaultJsonMcpConfigPath(client);
  const backupPath = backupConfig(configPath, options.now);
  const current = readJsonConfig(configPath);
  current.mcpServers = {
    ...(current.mcpServers ?? {}),
    langclaw: mcpServerDefinition(options.url, options.token),
  };

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`);
  return { backupPath, configPath };
}

export function uninstallJsonMcpClient(client: JsonMcpClient, configPathInput?: string): { configPath: string; removed: boolean } {
  const configPath = configPathInput ?? defaultJsonMcpConfigPath(client);
  if (!fs.existsSync(configPath)) {
    return { configPath, removed: false };
  }
  const current = readJsonConfig(configPath);
  const removed = Boolean(current.mcpServers?.langclaw);
  if (current.mcpServers) {
    delete current.mcpServers.langclaw;
  }
  fs.writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`);
  return { configPath, removed };
}

export function appendLangclawConfig(config: string, url: string, token: string): string {
  const withoutOld = removeLangclawConfig(config).trimEnd();
  return `${withoutOld ? `${withoutOld}\n\n` : ""}${generateCodexMcpToml(url, token)}`;
}

export function removeLangclawConfig(config: string): string {
  const lines = config.split(/\n/);
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^\s*\[mcp_servers\.(?:"langclaw"|langclaw)\]\s*$/.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^\s*\[/.test(line)) {
      skipping = false;
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join("\n").trimEnd() + (kept.length ? "\n" : "");
}

function backupConfig(configPath: string, now = new Date()): string | undefined {
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  const backupPath = `${configPath}.backup-langclaw-${timestamp(now)}`;
  fs.copyFileSync(configPath, backupPath);
  return backupPath;
}

function installSkill(skillPath: string): void {
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.copyFileSync(assetPath("skill", "SKILL.md"), skillPath);
}

function installPlugin(pluginPath: string, url: string, token: string): void {
  fs.rmSync(pluginPath, { force: true, recursive: true });
  fs.mkdirSync(path.join(pluginPath, ".codex-plugin"), { recursive: true });
  fs.mkdirSync(path.join(pluginPath, "skills", "langclaw-croo-agent"), { recursive: true });
  fs.copyFileSync(assetPath("plugin", ".codex-plugin", "plugin.json"), path.join(pluginPath, ".codex-plugin", "plugin.json"));
  fs.copyFileSync(
    assetPath("plugin", "skills", "langclaw-croo-agent", "SKILL.md"),
    path.join(pluginPath, "skills", "langclaw-croo-agent", "SKILL.md")
  );
  fs.writeFileSync(path.join(pluginPath, ".mcp.json"), generatePluginMcpJson(url, token));
}

function mcpServerDefinition(url: string, token: string): { args: string[]; command: "npx" } {
  return {
    command: "npx",
    args: ["@langclaw/mcp-client", "--url", url, "--token", token],
  };
}

function readJsonConfig(configPath: string): { mcpServers?: Record<string, unknown>; [key: string]: unknown } {
  if (!fs.existsSync(configPath)) {
    return { mcpServers: {} };
  }
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return { mcpServers: {} };
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { mcpServers: {} };
  }
  return parsed as { mcpServers?: Record<string, unknown>; [key: string]: unknown };
}

function defaultJsonMcpConfigPath(client: JsonMcpClient): string {
  if (client === "cursor") {
    return process.env.CURSOR_MCP_CONFIG || path.join(os.homedir(), ".cursor", "mcp.json");
  }
  return process.env.WINDSURF_MCP_CONFIG || path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
}

function resolveCodexHome(codexHome?: string): string {
  return codexHome || process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function assetPath(...parts: string[]): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", ...parts);
}

function timestamp(value: Date): string {
  const pad = (input: number) => String(input).padStart(2, "0");
  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds()),
  ].join("");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

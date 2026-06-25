import { readFileSync } from "node:fs";

const requiredFiles = [
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "skill/SKILL.md",
  "plugin/skills/langclaw-croo-agent/SKILL.md",
  "packages/mcp-client/package.json",
  "packages/mcp-client/assets/skill/SKILL.md",
  "packages/mcp-client/assets/plugin/.codex-plugin/plugin.json",
  "packages/mcp-client/assets/plugin/.mcp.json",
  "packages/mcp-client/assets/plugin/skills/langclaw-croo-agent/SKILL.md",
  "packages/mcp-client/src/cli.ts",
];

for (const file of requiredFiles) {
  readFileSync(file, "utf8");
}

const plugin = JSON.parse(readFileSync("plugin/.codex-plugin/plugin.json", "utf8")) as {
  interface?: { capabilities?: unknown; defaultPrompt?: unknown };
  mcpServers?: unknown;
  name?: unknown;
  skills?: unknown;
  version?: unknown;
};

assertString(plugin.name, "plugin.name");
assertString(plugin.version, "plugin.version");
if (plugin.skills !== "./skills/" || plugin.mcpServers !== "./.mcp.json") {
  throw new Error("plugin paths must point to packaged skills and MCP config.");
}
if (!Array.isArray(plugin.interface?.capabilities)) {
  throw new Error("plugin interface capabilities must be an array.");
}
if (!Array.isArray(plugin.interface?.defaultPrompt)) {
  throw new Error("plugin interface defaultPrompt must be an array.");
}
if (plugin.interface.defaultPrompt.length > 3) {
  throw new Error("plugin interface defaultPrompt must contain at most 3 prompts.");
}
for (const prompt of plugin.interface.defaultPrompt) {
  if (typeof prompt !== "string" || !prompt.startsWith("/langclaw")) {
    throw new Error("plugin interface defaultPrompt entries must use slash-style Langclaw prompts.");
  }
}

for (const file of ["skill/SKILL.md", "plugin/skills/langclaw-croo-agent/SKILL.md"]) {
  const skill = readFileSync(file, "utf8");
  if (!skill.startsWith("---\n")) {
    throw new Error(`${file} must start with frontmatter.`);
  }
  if (!/^name:\s+langclaw-croo-agent$/m.test(skill)) {
    throw new Error(`${file} must declare the langclaw-croo-agent skill.`);
  }
  if (!/^description:\s+.+/m.test(skill)) {
    throw new Error(`${file} must include a description.`);
  }
  if (!skill.includes("## Slash-Style Commands") || !skill.includes("/langclaw-onchain")) {
    throw new Error(`${file} must document slash-style Langclaw commands.`);
  }
}

const clientPackage = JSON.parse(readFileSync("packages/mcp-client/package.json", "utf8")) as {
  bin?: Record<string, string>;
  name?: unknown;
};

if (clientPackage.name !== "@langclaw/mcp-client") {
  throw new Error("client package must be named @langclaw/mcp-client.");
}

if (clientPackage.bin?.["langclaw-mcp-client"] !== "dist/cli.js") {
  throw new Error("client package must expose the langclaw-mcp-client binary.");
}

if (!readFileSync("packages/mcp-client/assets/plugin/.mcp.json", "utf8").includes("@langclaw/mcp-client")) {
  throw new Error("client plugin asset must point to @langclaw/mcp-client.");
}

console.log("Package validation passed.");

function assertString(value: unknown, label: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

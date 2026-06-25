export type ClientCommand =
  | "proxy"
  | "install-codex"
  | "install-claude"
  | "install-cursor"
  | "install-windsurf"
  | "print-codex-config"
  | "print-mcp-config"
  | "uninstall-codex"
  | "uninstall-claude"
  | "uninstall-cursor"
  | "uninstall-windsurf";

export type ClientOptions = {
  command: ClientCommand;
  help: boolean;
  installPlugin: boolean;
  timeoutMs: number;
  token: string;
  url: string;
};

export function parseClientOptions(
  argv: string[],
  env: Record<string, string | undefined> = process.env
): ClientOptions {
  const { command, rest } = readCommand(argv);
  const flags = readFlags(rest);
  const help = Boolean(flags.help || flags.h);
  const url = String(flags.url ?? env.LANGCLAW_REMOTE_URL ?? "").trim();
  const token = String(flags.token ?? env.LANGCLAW_ACCESS_TOKEN ?? "").trim();
  const timeoutMs = readPositiveInteger(flags["timeout-ms"] ?? env.LANGCLAW_TIMEOUT_MS, 30000);
  const installPlugin = !Boolean(flags["no-plugin"]);

  return {
    command,
    help,
    installPlugin,
    timeoutMs,
    token,
    url,
  };
}

export function validateClientOptions(options: ClientOptions): string[] {
  if (options.help) {
    return [];
  }

  const errors: string[] = [];
  if (options.command.startsWith("uninstall-")) {
    return errors;
  }
  if (!options.url) {
    errors.push("Missing --url or LANGCLAW_REMOTE_URL.");
  }
  if (!options.token) {
    errors.push("Missing --token or LANGCLAW_ACCESS_TOKEN.");
  }
  if (options.url) {
    try {
      new URL(options.url);
    } catch {
      errors.push("Remote URL must be a valid URL.");
    }
  }
  return errors;
}

export function helpText(): string {
  return [
    "Langclaw MCP Client",
    "",
    "Usage:",
    "  npx @langclaw/mcp-client --url https://your-domain.com/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client install-claude --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client install-cursor --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client install-windsurf --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client print-mcp-config --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client print-codex-config --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN",
    "  npx @langclaw/mcp-client uninstall-codex",
    "",
    "Commands:",
    "  install-codex        Install MCP, skill, and plugin into Codex.",
    "  install-claude       Install Langclaw into Claude Code CLI.",
    "  install-cursor       Install Langclaw into Cursor MCP config.",
    "  install-windsurf     Install Langclaw into Windsurf MCP config.",
    "  print-mcp-config     Print a standard MCP JSON config.",
    "  print-codex-config   Print the Codex MCP config block.",
    "  uninstall-codex      Remove Langclaw Codex config, skill, and plugin.",
    "  uninstall-claude     Remove Langclaw from Claude Code CLI.",
    "  uninstall-cursor     Remove Langclaw from Cursor MCP config.",
    "  uninstall-windsurf   Remove Langclaw from Windsurf MCP config.",
    "",
    "Options:",
    "  --url <url>             Hosted Langclaw MCP endpoint.",
    "  --token <token>         Langclaw license or admin access token.",
    "  --timeout-ms <number>   HTTP timeout in milliseconds. Default: 30000.",
    "  --no-plugin             Install MCP and skill only.",
    "  --help                  Show this help.",
    "",
    "Environment:",
    "  LANGCLAW_REMOTE_URL",
    "  LANGCLAW_ACCESS_TOKEN",
    "  LANGCLAW_TIMEOUT_MS",
  ].join("\n");
}

export function redactErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/(--token(?:=|\s+))([A-Za-z0-9._~+/=-]+)/g, "$1[redacted]")
    .replace(/lc_live_[A-Za-z0-9_-]+/g, "lc_live_[redacted]");
}

function readCommand(argv: string[]): { command: ClientCommand; rest: string[] } {
  const first = argv[0];
  if (
    first === "install-codex" ||
    first === "install-claude" ||
    first === "install-cursor" ||
    first === "install-windsurf" ||
    first === "print-codex-config" ||
    first === "print-mcp-config" ||
    first === "uninstall-codex" ||
    first === "uninstall-claude" ||
    first === "uninstall-cursor" ||
    first === "uninstall-windsurf"
  ) {
    return { command: first, rest: argv.slice(1) };
  }
  return { command: "proxy", rest: argv };
}

function readFlags(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const raw = item.slice(2);
    const [key, inlineValue] = raw.split("=", 2);
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
      continue;
    }
    result[key] = true;
  }
  return result;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

# Langclaw MCP Client

Stdio MCP proxy and installer for the hosted Langclaw CROO Agent.

Install Langclaw into Codex:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

This installs:

- Codex MCP config
- Langclaw Codex skill
- Langclaw Codex plugin

After installing, Codex can use slash-style prompts:

```text
/langclaw-research CROO agent market fit
/langclaw-onchain Base smart money last 7 days
/langclaw-builder-review Review this repo for CROO
```

Install without plugin:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN --no-plugin
```

Install into Claude Code CLI:

```bash
npx @langclaw/mcp-client install-claude --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Install into Cursor:

```bash
npx @langclaw/mcp-client install-cursor --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Install into Windsurf:

```bash
npx @langclaw/mcp-client install-windsurf --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Print standard MCP config:

```bash
npx @langclaw/mcp-client print-mcp-config --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Uninstall:

```bash
npx @langclaw/mcp-client uninstall-codex
npx @langclaw/mcp-client uninstall-claude
npx @langclaw/mcp-client uninstall-cursor
npx @langclaw/mcp-client uninstall-windsurf
```

Run as a stdio MCP proxy:

```bash
npx @langclaw/mcp-client --url https://your-domain.com/mcp --token LICENSE_TOKEN
```

Environment variables:

- `LANGCLAW_REMOTE_URL`
- `LANGCLAW_ACCESS_TOKEN`
- `LANGCLAW_TIMEOUT_MS`

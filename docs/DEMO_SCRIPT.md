# Demo Script

Target length: 5 minutes.

## 1. Open

Langclaw CROO Agent is a paid callable agent for CROO CAP and hosted MCP coding tools. It gives coding agents source-backed research and read-only onchain intelligence without asking users to clone the backend repository.

## 2. Show Readiness

Run:

```bash
npm run smoke:readiness
npm run smoke:croo-live
```

Show that research provider keys, onchain provider keys, hosted MCP access, and CROO credentials are configured on the operator VPS.

## 3. Show Hosted MCP Install

Show the one-line Codex install:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Explain that it installs the MCP config, Codex skill, and Codex plugin. Then show the manual config for other MCP clients:

```json
{
  "mcpServers": {
    "langclaw": {
      "command": "npx",
      "args": [
        "@langclaw/mcp-client",
        "--url",
        "https://langclaw.nanta.tech/mcp",
        "--token",
        "LICENSE_TOKEN"
      ]
    }
  }
}
```

The CROO license delivery also includes all one-line commands with the buyer token already inserted:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token]
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token] --no-plugin
npx @langclaw/mcp-client install-claude --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token]
npx @langclaw/mcp-client install-cursor --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token]
npx @langclaw/mcp-client install-windsurf --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token]
npx @langclaw/mcp-client --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token]
npx @langclaw/mcp-client print-mcp-config --url https://langclaw.nanta.tech/mcp --token lc_live_[buyer-token]
npx @langclaw/mcp-client uninstall-codex
```

Show the Codex slash-style prompts included in the delivery:

```text
/langclaw-research CROO agent market fit
/langclaw-onchain Base smart money last 7 days
/langclaw-builder-review Review this repo for CROO
/langclaw-verify Langclaw supports hosted MCP access
/langclaw-readiness
```

## 4. Show MCP Tools

Run:

```bash
npm run server
```

Explain the available tools:

- `langclaw_research`
- `langclaw_verify_claim`
- `langclaw_builder_review`
- `langclaw_onchain_intelligence`
- `langclaw_readiness`

## 5. Show Onchain Intelligence

Use a prompt such as:

```text
Run smart money accumulation on Base last 7 days.
```

Explain that broad research prompts auto-route to onchain when they mention wallets, contracts, TVL, liquidity, token holders, transactions, bridges, governance, or chain activity.

## 6. Show CROO Delivery

Run:

```bash
LANGCLAW_PROVIDER_MODE=mock npm run croo:provider
```

Show:

- capability id
- result summary
- provider trace
- delivery hash
- source count

Then show the license service:

```bash
LANGCLAW_PROVIDER_MODE=mock LANGCLAW_MOCK_CAPABILITY=langclaw.builder.pass.license npm run croo:provider
```

Show the 30-day license, install command, and included tools. Redact the license token in the recording.

## 7. Close

The same agent can run as a CROO paid provider and as a hosted MCP tool inside Codex, Claude Code CLI, Cursor, Windsurf, and other compatible tools.

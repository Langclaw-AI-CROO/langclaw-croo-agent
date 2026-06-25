# Sample Payloads

## CROO Research Order

```json
{
  "id": "order-research-1",
  "capabilityId": "langclaw.research.brief",
  "input": {
    "topic": "CROO paid research agent",
    "mode": "hackathon-fit",
    "responseLanguage": "en"
  }
}
```

## CROO Onchain Order

```json
{
  "id": "order-onchain-1",
  "capabilityId": "langclaw.onchain.intelligence",
  "input": {
    "query": "smart money accumulation on Base last 7 days",
    "chain": "base",
    "responseLanguage": "en"
  }
}
```

## Hosted MCP Config

Codex one-line install:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

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

## CROO License Delivery

```json
{
  "orderId": "order-license-1",
  "capabilityId": "langclaw.builder.pass.license",
  "status": "delivered",
  "license": {
    "token": "lc_live_[redacted]",
    "label": "buyer",
    "issuedAt": "2026-06-24T00:00:00.000Z",
    "expiresAt": "2026-07-24T00:00:00.000Z",
    "maxCalls": 300
  },
  "install": {
    "mcpUrl": "https://langclaw.nanta.tech/mcp",
    "codex": "npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
    "oneLineCommands": {
      "claudeCode": "npx @langclaw/mcp-client install-claude --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
      "codex": "npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
      "codexNoPlugin": "npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted] --no-plugin",
      "cursor": "npx @langclaw/mcp-client install-cursor --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
      "genericMcpProxy": "npx @langclaw/mcp-client --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
      "printCodexConfig": "npx @langclaw/mcp-client print-codex-config --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
      "printMcpConfig": "npx @langclaw/mcp-client print-mcp-config --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]",
      "uninstallCodex": "npx @langclaw/mcp-client uninstall-codex",
      "uninstallClaude": "npx @langclaw/mcp-client uninstall-claude",
      "uninstallCursor": "npx @langclaw/mcp-client uninstall-cursor",
      "uninstallWindsurf": "npx @langclaw/mcp-client uninstall-windsurf",
      "windsurf": "npx @langclaw/mcp-client install-windsurf --url https://langclaw.nanta.tech/mcp --token lc_live_[redacted]"
    }
  },
  "service": {
    "name": "Langclaw Builder Pass License",
    "durationDays": 30,
    "slaMinutes": 30,
    "includedTools": [
      "langclaw_research",
      "langclaw_onchain_intelligence",
      "langclaw_verify_claim",
      "langclaw_builder_review",
      "langclaw_readiness"
    ]
  }
}
```

The human-readable CROO delivery starts with install commands and includes:

```text
/langclaw-research CROO agent market fit
/langclaw-onchain Base smart money last 7 days
/langclaw-builder-review Review this repo for CROO
/langclaw-verify Langclaw supports hosted MCP access
/langclaw-readiness
```

## Expected Delivery Fields

```json
{
  "orderId": "order-onchain-1",
  "capabilityId": "langclaw.onchain.intelligence",
  "status": "delivered",
  "proof": {
    "deliveryHash": "sha256-hash",
    "generatedAt": "iso-date",
    "sourceCount": 5
  }
}
```

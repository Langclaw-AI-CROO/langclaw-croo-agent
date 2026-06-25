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
  "serviceName": "Langclaw Onchain Intelligence",
  "capabilityId": "langclaw.onchain.intelligence",
  "input": {
    "research_prompt": "Find current Base ecosystem signals useful for another agent workflow.",
    "chain": "base",
    "scope": "chain",
    "timeframe": "7d",
    "targetUse": "agent-context",
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
  "type": "langclaw-onchain-intelligence",
  "version": "1.0",
  "orderId": "order-onchain-1",
  "capabilityId": "langclaw.onchain.intelligence",
  "status": "delivered",
  "summary": "Source-backed intelligence summary.",
  "keyFindings": [
    {
      "finding": "Semantic finding based on source-backed onchain evidence.",
      "confidence": "medium",
      "whyItMatters": "Another agent can reuse this as market or due diligence context.",
      "evidenceIds": ["onchain-source-1"]
    }
  ],
  "signals": [
    {
      "name": "Source-backed market signal",
      "category": "chain",
      "strength": "medium",
      "description": "Signal derived from validated onchain provider summaries."
    }
  ],
  "risks": [
    {
      "risk": "Partial evidence",
      "severity": "low",
      "mitigation": "Recheck source data before time-sensitive use."
    }
  ],
  "opportunities": [
    {
      "opportunity": "Reuse this packet as agent workflow context.",
      "targetUse": "agent-context"
    }
  ],
  "agentReuse": {
    "recommendedUses": [
      "agent-context",
      "campaign-grounding",
      "market-brief",
      "token-due-diligence",
      "wallet-analysis",
      "protocol-research"
    ],
    "contentAngles": [],
    "decisionInputs": []
  },
  "sources": [],
  "onchainContext": {
    "chain": "base",
    "addresses": [],
    "transactionHashes": [],
    "metrics": []
  },
  "limitations": [
    "This brief is read-only intelligence and does not execute trades or transactions.",
    "Signals should be rechecked if used for time-sensitive decisions."
  ],
  "proof": {
    "deliveryHash": "sha256-hash",
    "inputHash": "sha256-hash",
    "generatedAt": "iso-date",
    "sourceCount": 5
  }
}
```

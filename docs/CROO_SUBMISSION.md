# CROO Submission Notes

## Product

Langclaw CROO Agent is a callable research service for agent commerce. It accepts a research task, runs provider-backed analysis, and returns a delivery payload with a hash, source count, and execution log. The onchain intelligence service adds semantic planning and synthesis over validated read-only tools. It also exposes the same intelligence through a hosted MCP endpoint for coding tools.

## Capability

`langclaw.research.brief`

`langclaw.onchain.intelligence`

`langclaw.builder.pass.license`

Primary CROO Store service:

```text
Langclaw Onchain Intelligence
Price: 0.10 USDC
SLA: 15 minutes
Deliverable: Schema
Requirements: Schema
```

Inputs:

- `topic`
- `mode`
- `chain`
- `responseLanguage`
- `maxDepth`
- `context`

Onchain inputs:

- `research_prompt`
- `chain`
- `scope`
- `tokenAddress`
- `walletAddress`
- `contractAddress`
- `transactionHash`
- `timeframe`
- `targetUse`
- `responseLanguage`

Outputs:

- summary
- key findings
- signals
- risks
- opportunities
- agent reuse hints
- sources
- onchain context
- delivery proof
- semantic onchain synthesis when configured
- onchain route debug when the onchain capability is used
- Markdown report
- hosted MCP tool response
- license token delivery for hosted MCP access

## Demo Flow

1. Start hosted MCP server and call `langclaw_readiness`.
2. Call `langclaw_builder_review` for the project.
3. Call `langclaw_onchain_intelligence` for Base chain or token analytics.
4. Show `npx @langclaw/mcp-client` as the user install path with a license token.
5. Start the live CROO provider.
6. Run the requester smoke against the `Langclaw Onchain Intelligence` service ID.
7. Show the schema delivery packet and evidence report.
8. Show that Codex install includes MCP, skill, and plugin.

## Dune Dynamic SQL

The onchain intelligence route supports safe generated Dune SQL for DEX accumulation analytics. The SQL builder uses allowlisted chain names, bounded day windows, bounded minimum USD thresholds, escaped token symbols, and no arbitrary user SQL.

## Acceptance Checklist

- Typecheck passes.
- Unit tests pass.
- MCP server starts.
- Hosted MCP server starts.
- Remote MCP client connects with a license token.
- Codex installer writes MCP, skill, and plugin.
- Provider mock delivery works.
- Onchain parser and planner tests pass.
- Onchain semantic reasoning tests pass.
- Plugin validator passes.
- Skill validator passes.
- Cleanup scan returns no matches.
- Secret scan returns no matches.
- Dune dynamic SQL tests pass.

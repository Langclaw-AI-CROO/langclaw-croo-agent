# DoraHacks Submission Copy

## Project Name

Langclaw CROO Agent

## Short Description

Paid callable research and onchain intelligence agent for CROO CAP and hosted MCP coding tools.

## Problem

Coding agents can generate plans, but they often lack structured provider-backed Web3 intelligence. Teams still need to manually gather market data, onchain signals, source links, and delivery proof before making agent-commerce outputs useful.

## Solution

Langclaw CROO Agent exposes reusable tools that coding agents can call through a hosted MCP endpoint and that buyers can call through CROO CAP. The agent returns structured research, read-only onchain intelligence, provider trace, source URLs, risk flags, and delivery proof.

## CROO Fit

The project implements callable paid capabilities:

- `langclaw.research.brief`
- `langclaw.onchain.intelligence`
- `langclaw.builder.pass.license`

Each order produces a delivery payload with result data and a delivery hash. The same core tools can be reused by Codex, Claude Code CLI, Cursor, Windsurf, and other MCP clients through `npx @langclaw/mcp-client`, without cloning the backend repository. Paid MCP access uses a 30-day license token delivered through the `Langclaw Builder Pass License` service. The license delivery includes readable install instructions, one-line commands for Codex, Claude Code CLI, Cursor, Windsurf, generic MCP clients, and slash-style Codex prompts.

## Technical Highlights

- CROO provider with research, onchain intelligence, and license pass capability schemas.
- Hosted MCP server with research, claim verification, builder review, readiness, and onchain intelligence tools.
- Stdio MCP client package for Codex, Claude Code CLI, Cursor, and Windsurf.
- One-line installers for Codex, Claude Code CLI, Cursor, and Windsurf.
- Chain-neutral onchain router with Base as the default chain.
- Dune dynamic SQL for safe generated DEX accumulation analytics.
- Deterministic structured output with provider trace and blocked fallback logs.
- No transaction execution, signing, swaps, approvals, custody, or value transfer.

## Demo

The demo shows:

1. MCP readiness.
2. Builder review.
3. Onchain intelligence for Base.
4. Hosted MCP and Codex plugin install through `npx @langclaw/mcp-client install-codex` with a CROO-delivered license token.
5. CROO mock order delivery.
6. Delivery proof and provider trace.

## Repository

Add the final GitHub URL here after publishing.

## License

MIT

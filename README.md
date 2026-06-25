# Langclaw CROO Agent

Langclaw CROO Agent is a paid callable research agent for CROO CAP and MCP-compatible coding tools.

It turns a research request into a concise report with sources, confidence, provider trace, and delivery proof. The same core agent runs behind a CROO provider, a hosted MCP server, a local MCP server, and a Codex plugin.

Langclaw can run without a model API key for non-onchain services. `Langclaw Onchain Intelligence` can optionally use a semantic reasoning layer on the operator VPS, then validate and run Langclaw's read-only onchain tools before returning delivery proof.

## What It Does

- Accepts paid research orders through CROO CAP.
- Exposes `Langclaw Onchain Intelligence` as a 0.10 USDC schema service for requester agents.
- Exposes MCP tools for Codex, Claude Code CLI, Cursor, Windsurf, and other MCP clients.
- Ships a Codex plugin with a small skill that tells an agent when to call Langclaw.
- Produces source-backed research, onchain intelligence, claim checks, builder submission reviews, and readiness checks.

## Main Tools

- `langclaw_research`: Research a protocol, project, token, market topic, or agent idea.
- `langclaw_verify_claim`: Check whether a claim has enough source support.
- `langclaw_builder_review`: Review whether a project fits a builder program, hackathon, grant, or submission goal.
- `langclaw_onchain_intelligence`: Run read-only chain, token, wallet, contract, transaction, bridge, governance, or protocol analytics.
- `langclaw_readiness`: Check local provider, model, MCP, and CROO configuration.

Strong onchain prompts sent through `langclaw_research` also auto-route to onchain intelligence. Examples include wallet, contract, transaction, TVL, liquidity, pool, bridge, governance, token holder, and chain activity requests.

## User Install

Users do not need to clone this repository or bring provider API keys. The hosted Langclaw server runs on the operator VPS and keeps the provider keys there.

Codex one-line install:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

This installs the hosted MCP config, Langclaw skill, and Langclaw plugin.

Codex also understands slash-style Langclaw prompts through the installed skill:

```text
/langclaw-research CROO agent market fit
/langclaw-onchain Base smart money last 7 days
/langclaw-builder-review Review this repo for CROO
/langclaw-verify Langclaw supports hosted MCP access
/langclaw-readiness
```

Claude Code CLI one-line install:

```bash
npx @langclaw/mcp-client install-claude --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Cursor one-line install:

```bash
npx @langclaw/mcp-client install-cursor --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Windsurf one-line install:

```bash
npx @langclaw/mcp-client install-windsurf --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN
```

Install without plugin:

```bash
npx @langclaw/mcp-client install-codex --url https://langclaw.nanta.tech/mcp --token LICENSE_TOKEN --no-plugin
```

Uninstall from Codex:

```bash
npx @langclaw/mcp-client uninstall-codex
```

Manual MCP client config:

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

The same manual config shape works for Codex, Claude Code CLI, Cursor, Windsurf, and MCP clients that launch stdio servers. Codex remains the richest install because it also writes the Langclaw skill and plugin.

## CROO Store

End users can also use Langclaw without installing anything:

1. Open the CROO Agent Store.
2. Select Langclaw Intel.
3. Order `Langclaw Builder Pass License` for 30-day hosted MCP access.
4. Use the returned license token with Codex, Claude Code CLI, Cursor, Windsurf, or another MCP client.
5. Order `langclaw.research.brief` or `langclaw.onchain.intelligence` for direct CROO delivery.

Recommended CROO dashboard service:

```text
Service Name: Langclaw Onchain Intelligence
Description: Source-backed onchain intelligence for agents that need read-only chain, token, wallet, contract, protocol, and market context. Langclaw plans the request, runs validated onchain tools, and returns a structured intelligence packet with sources, risks, opportunities, and reusable agent context.
Price: 0.10 USDC
SLA: 15 minutes
Deliverable: Schema
Requirements: Schema
```

## VPS Operator Setup

```bash
npm install
cp .env.example .env
```

Store provider keys only on the VPS:

- `TAVILY_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `GITHUB_TOKEN`
- `ETHERSCAN_API_KEY`
- `ALCHEMY_API_KEY`
- `GOPLUS_API_KEY`
- `GOPLUS_API_SECRET`
- `DUNE_API_KEY`
- `OPENAI_API_KEY`
- `CROO_API_KEY`
- `CROO_TARGET_SERVICE_ID`
- `LANGCLAW_ONCHAIN_SERVICE_ID`
- `LANGCLAW_ACCESS_TOKENS`
- `LANGCLAW_ADMIN_ACCESS_TOKENS`
- `LANGCLAW_LICENSE_STORE_PATH`
- `LANGCLAW_LICENSE_DEFAULT_DAYS`
- `LANGCLAW_LICENSE_DEFAULT_CALLS`
- `LANGCLAW_CROO_EVIDENCE_LOG_PATH`

Start the hosted MCP server:

```bash
npm run server
```

Start the CROO provider separately:

```bash
npm run croo:provider
```

## Local Development MCP

```bash
npm run mcp
```

Example MCP client command:

```json
{
  "mcpServers": {
    "langclaw-croo-agent": {
      "command": "npm",
      "args": ["--prefix", "/Users/ridhorinanta/hackathon/langclaw-croo-agent", "run", "mcp"]
    }
  }
}
```

## Local Client Setup

Codex plugin:

- Plugin manifest: `plugin/.codex-plugin/plugin.json`
- Plugin MCP config: `plugin/.mcp.json`
- Plugin skill: `plugin/skills/langclaw-croo-agent/SKILL.md`

Codex MCP:

- Add the MCP command above to Codex MCP settings.
- Keep this repo path stable so the stdio command can find the server.

Claude Code CLI:

- Add an MCP server named `langclaw-croo-agent`.
- Use `npm` as the command.
- Use `--prefix`, this repo path, `run`, and `mcp` as args.

Cursor:

- Add the same stdio MCP server command to Cursor MCP settings.
- Restart Cursor after adding the server.

Windsurf:

- Add the same stdio MCP server command to Windsurf MCP settings.
- Restart the MCP server if `.env` changes.

## Run CROO Provider

```bash
npm run croo:provider
```

Required live settings:

- `CROO_API_URL`
- `CROO_WS_URL`
- `CROO_SDK_KEY` or `CROO_API_KEY`
- `LANGCLAW_PROVIDER_FUND_ADDRESS` for CROO fund-transfer services
- `LANGCLAW_AGENT_PRICE_USDC`
- `LANGCLAW_ONCHAIN_SERVICE_ID` for the CROO dashboard service ID of `Langclaw Onchain Intelligence`
- `LANGCLAW_ACCESS_TOKENS` for hosted MCP access control
- `LANGCLAW_ADMIN_ACCESS_TOKENS` for hosted MCP admin fallback access
- `LANGCLAW_LICENSE_STORE_PATH` for paid license token storage
- `LANGCLAW_CROO_EVIDENCE_LOG_PATH` for CAP order evidence logs

`CROO_API_KEY` is the name shown by the CROO dashboard. `CROO_SDK_KEY` is also supported for compatibility with SDK docs. Do not export a private key from your main browser wallet for this repo. CROO shows the agent account wallet in its dashboard. Fund that agent account when CROO requires balance for paid actions.

`LANGCLAW_PROVIDER_FUND_ADDRESS` must be a Base mainnet EVM address such as `0x...`. The provider only uses it when a CROO negotiation includes fund-transfer fields. Non-fund services keep the normal CROO escrow flow.

The provider appends safe CAP lifecycle evidence to `LANGCLAW_CROO_EVIDENCE_LOG_PATH`. Each JSONL row records the stage, negotiation ID, order ID, capability, input hash, settlement mode, delivery hash, and source count when available. It does not store raw buyer prompts, API keys, or license tokens.

For A2A smoke tests, set `CROO_TARGET_SERVICE_ID` to the same service ID as `LANGCLAW_ONCHAIN_SERVICE_ID`. Requester agents should send `langclaw.onchain.intelligence` requirements with `research_prompt`, `chain`, `scope`, `timeframe`, `targetUse`, and `responseLanguage`. `query` remains supported as a backward-compatible alias.

## License Tokens

Paid MCP access uses a license token. The default paid license lasts 30 days and allows 300 MCP tool calls.

Create a demo license:

```bash
npm run license:create -- --label demo --days 7 --calls 50
```

List licenses:

```bash
npm run license:list
```

Revoke a license:

```bash
npm run license:revoke -- --token lc_live_xxx
```

The license registry stores token hashes only. Keep `data/licenses.json` on the VPS and do not commit it.

Optional onchain settings:

- `ETHERSCAN_API_KEY`
- `ALCHEMY_API_KEY`
- `GOPLUS_API_KEY`
- `GOPLUS_API_SECRET`
- `DUNE_API_KEY`
- `DUNE_DEFAULT_QUERY_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `LANGCLAW_ONCHAIN_REASONING_ENABLED`
- `LANGCLAW_ONCHAIN_REASONING_EFFORT`
- `LANGCLAW_ONCHAIN_REASONING_REQUIRED`
- `LANGCLAW_ONCHAIN_REASONING_MAX_INPUT_CHARS`
- `LANGCLAW_ONCHAIN_REASONING_MAX_OUTPUT_TOKENS`
- `LANGCLAW_ONCHAIN_REASONING_MAX_RETRIES`

Onchain semantic reasoning is scoped only to `Langclaw Onchain Intelligence`. It receives the buyer `research_prompt` and safe provider summaries, not raw provider payloads, env dumps, API keys, private keys, license tokens, or full evidence logs. Keep `LANGCLAW_ONCHAIN_REASONING_REQUIRED=false` for demo fallback unless you want paid onchain orders to fail when the semantic layer is unavailable.

Use `LANGCLAW_PROVIDER_MODE=mock` to run a local dry run without opening a live provider connection.

Check live credential readiness:

```bash
npm run smoke:croo-live
```

Run a live requester smoke order from a separate CROO requester agent:

```bash
npm run croo:requester-smoke
npm run croo:evidence-report
```

The requester smoke uses the requester agent's own CROO key. It reads `CROO_REQUESTER_SDK_KEY` first for shared local `.env` files, then falls back to the official `CROO_SDK_KEY` name from the CROO docs. Do not share the Langclaw provider key with buyers or external requester agents.

The requester smoke writes a redacted summary to `data/croo-requester-smoke.json`. The report command turns provider and requester evidence into `docs/CROO_LIVE_EVIDENCE.md` for demo and submission review.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run smoke:readiness
npm run smoke:croo-live
npm run validate:package
npm run scan:cleanup
npm run scan:dash
```

## Submission Story

Langclaw CROO Agent shows agent commerce in practice. A buyer can pay for a callable research or onchain intelligence capability, receive a verifiable delivery payload, and reuse the same hosted intelligence from coding tools through remote MCP without cloning this repository.

## Submission Docs

- [Demo script](docs/DEMO_SCRIPT.md)
- [DoraHacks submission copy](docs/DORAHACKS_SUBMISSION.md)
- [Sample payloads](docs/SAMPLE_PAYLOADS.md)

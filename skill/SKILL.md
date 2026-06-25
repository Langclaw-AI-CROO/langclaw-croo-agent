---
name: langclaw-croo-agent
description: Use the Langclaw CROO Agent MCP tools for source-backed Web3 research, read-only onchain intelligence, CROO builder reviews, claim verification, readiness checks, and agent commerce submission work. Trigger when a user asks to research a protocol, inspect wallet or token activity, verify a project claim, review CROO fit, prepare a CROO submission, or use Langclaw as an MCP-powered coding assistant tool.
---

# Langclaw CROO Agent

Use this skill when Langclaw should provide source-backed research through the MCP server.

## Workflow

1. Use `langclaw_readiness` before live demo or provider work.
2. Use `langclaw_research` for broad research on protocols, projects, token topics, and agent ideas.
3. Use `langclaw_onchain_intelligence` for wallets, tokens, contracts, liquidity, TVL, transactions, bridges, governance, or protocol metrics.
4. Use `langclaw_verify_claim` when the user asks whether a specific claim is supported.
5. Use `langclaw_builder_review` when the user asks whether a project matches a builder program, hackathon, grant, or submission.
6. Treat low confidence output as a draft and ask for stronger provider configuration before final decisions.

## Slash-Style Commands

When the user types one of these commands, call the matching Langclaw MCP tool:

- `/langclaw <query>`: use `langclaw_command` or `langclaw_research`.
- `/langclaw-research <query>`: use `langclaw_command` or `langclaw_research`.
- `/langclaw-onchain <query>`: use `langclaw_command` or `langclaw_onchain_intelligence`.
- `/langclaw-verify <claim>`: use `langclaw_command` or `langclaw_verify_claim`.
- `/langclaw-builder-review <project>`: use `langclaw_command` or `langclaw_builder_review`.
- `/langclaw-readiness`: use `langclaw_command` or `langclaw_readiness`.

Examples:

- `/langclaw-research CROO agent market fit`
- `/langclaw-onchain Base smart money last 7 days`
- `/langclaw-builder-review Review this repo for CROO`
- `/langclaw-verify Langclaw supports hosted MCP access`
- `/langclaw-readiness`

## Output Rules

- Keep conclusions short.
- Cite the source titles and URLs returned by the MCP tool.
- Separate facts, caveats, and recommendations.
- Do not invent provider results.
- Do not call the CROO provider unless the user asks to run or test provider flow.
- Reject requests that require signing, swaps, approvals, custody, or value transfer.
- If the user sends an onchain-style prompt through broad research, expect the core agent to auto-route it to onchain intelligence.

## CROO Submission Checks

Confirm these points before calling a submission ready:

- The capability is callable.
- The provider can receive a paid order.
- The result includes delivery proof.
- The MCP tools work from a coding assistant.
- The onchain tool is read-only and preserves query scope.
- The README explains CAP, MCP, plugin, and skill usage.

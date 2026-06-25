import "dotenv/config";

process.env.CROO_TARGET_SERVICE_ID = "a8f1c20d-73f4-4551-856a-32315e18d261";
process.env.CROO_SMOKE_CAPABILITY_ID = "universal.workbench.agent";
process.env.CROO_SMOKE_REQUIREMENTS_TYPE = "text";
process.env.CROO_SMOKE_PROMPT ??=
  "Create a Universal Work Pack from this Langclaw onchain intelligence task: analyze current Base ecosystem signals for another agent workflow, then return action steps, evidence checklist, and A2A reuse plan.";
process.env.CROO_SMOKE_CHAIN ??= "base";
process.env.CROO_SMOKE_SCOPE ??= "chain";
process.env.CROO_SMOKE_TARGET_USE ??= "agent-context";
process.env.CROO_SMOKE_TIMEFRAME ??= "7d";
process.env.CROO_SMOKE_PAY ??= "true";
process.env.CROO_REQUESTER_SMOKE_OUTPUT_PATH = "data/croo-a2a-workbench-smoke.json";
process.env.CROO_SMOKE_COMMAND_LABEL = "node --import tsx scripts/croo-a2a-workbench-smoke.ts";

await import("./croo-requester-smoke.js");

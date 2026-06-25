import { executeOnchainPlan } from "./executor.js";
import { parseOnchainIntent } from "./parser.js";
import { planOnchainTools } from "./planner.js";
import { synthesizeOnchainOutput } from "./synthesizer.js";
import type { OnchainCommandId, OnchainInput, OnchainOutput } from "./types.js";
import type { ProviderExecutor } from "./providers.js";

export async function runOnchainIntelligence(
  input: OnchainInput,
  deps: { executors?: Partial<Record<OnchainCommandId, ProviderExecutor>> } = {}
): Promise<OnchainOutput> {
  const intent = parseOnchainIntent(input);
  const plan = planOnchainTools(intent, input);
  const tools = await executeOnchainPlan(plan, deps);
  return synthesizeOnchainOutput(plan, tools);
}

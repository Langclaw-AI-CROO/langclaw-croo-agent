import { executeOnchainPlan } from "./executor.js";
import { parseOnchainIntent } from "./parser.js";
import { planOnchainTools } from "./planner.js";
import {
  applySemanticIntent,
  applySemanticSynthesis,
  assertOnchainQueryAllowed,
  createDefaultOnchainReasoner,
  OnchainReasoningError,
  readOnchainReasoningConfig,
  type OnchainReasoner,
} from "./reasoning.js";
import { synthesizeOnchainOutput } from "./synthesizer.js";
import type { OnchainCommandId, OnchainInput, OnchainOutput } from "./types.js";
import type { ProviderExecutor } from "./providers.js";

export async function runOnchainIntelligence(
  input: OnchainInput,
  deps: {
    executors?: Partial<Record<OnchainCommandId, ProviderExecutor>>;
    reasoner?: OnchainReasoner | false;
  } = {}
): Promise<OnchainOutput> {
  assertOnchainQueryAllowed(input.query);
  const reasoningConfig = readOnchainReasoningConfig();
  const reasoner = deps.reasoner === false ? undefined : deps.reasoner ?? createDefaultOnchainReasoner(reasoningConfig);
  const plannedInput = await planInput(input, reasoner, reasoningConfig.required);
  const intent = parseOnchainIntent(plannedInput);
  const plan = planOnchainTools(intent, plannedInput);
  const tools = await executeOnchainPlan(plan, deps);
  const output = synthesizeOnchainOutput(plan, tools);
  if (!reasoner) {
    return output;
  }
  try {
    return applySemanticSynthesis(output, await reasoner.synthesize(output));
  } catch (error) {
    if (reasoningConfig.required) {
      throw error;
    }
    return output;
  }
}

async function planInput(input: OnchainInput, reasoner: OnchainReasoner | undefined, required: boolean): Promise<OnchainInput> {
  if (!reasoner) {
    return input;
  }
  try {
    return applySemanticIntent(input, await reasoner.planIntent(input));
  } catch (error) {
    if (required || error instanceof OnchainReasoningError) {
      throw error;
    }
    return input;
  }
}

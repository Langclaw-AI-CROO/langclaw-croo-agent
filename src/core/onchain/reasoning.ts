import OpenAI from "openai";

import { redactSecrets } from "../redact.js";
import type { AgentTargetUse } from "../types.js";
import { onchainCommands } from "./registry.js";
import type { OnchainCommandId, OnchainInput, OnchainOutput, OnchainScope, OnchainSemanticResult } from "./types.js";

type SafetyDecision = "safe" | "needs-review" | "refused";
type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export type SemanticIntentPlan = {
  normalizedQuery: string;
  chain?: string;
  scope: OnchainScope;
  entities: Array<{
    type: "chain" | "token" | "protocol" | "wallet" | "contract" | "transaction" | "bridge" | "governance";
    value: string;
  }>;
  timeframe?: string;
  toolHints: OnchainCommandId[];
  safetyDecision: SafetyDecision;
  refusalReason?: string;
};

export type OnchainReasoner = {
  planIntent(input: OnchainInput): Promise<SemanticIntentPlan>;
  synthesize(output: OnchainOutput): Promise<OnchainSemanticResult>;
};

export type OnchainReasoningConfig = {
  enabled: boolean;
  maxInputChars: number;
  maxOutputTokens: number;
  maxRetries: number;
  model: string;
  reasoningEffort: ReasoningEffort;
  required: boolean;
};

export class OnchainReasoningError extends Error {}

const supportedScopes: OnchainScope[] = ["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance", "unknown"];
const supportedTargetUses: AgentTargetUse[] = [
  "agent-context",
  "campaign-grounding",
  "market-brief",
  "token-due-diligence",
  "wallet-analysis",
  "protocol-research",
  "claim-verification",
  "hackathon-research",
];
const commandIds = onchainCommands.map((command) => command.id);

export function readOnchainReasoningConfig(env: NodeJS.ProcessEnv = process.env): OnchainReasoningConfig {
  return {
    enabled: env.LANGCLAW_ONCHAIN_REASONING_ENABLED === "true",
    maxInputChars: readPositiveInt(env.LANGCLAW_ONCHAIN_REASONING_MAX_INPUT_CHARS, 12000),
    maxOutputTokens: readPositiveInt(env.LANGCLAW_ONCHAIN_REASONING_MAX_OUTPUT_TOKENS, 1200),
    maxRetries: readPositiveInt(env.LANGCLAW_ONCHAIN_REASONING_MAX_RETRIES, 1),
    model: env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
    reasoningEffort: readReasoningEffort(env.LANGCLAW_ONCHAIN_REASONING_EFFORT),
    required: env.LANGCLAW_ONCHAIN_REASONING_REQUIRED === "true",
  };
}

export function createDefaultOnchainReasoner(config = readOnchainReasoningConfig()): OnchainReasoner | undefined {
  if (!config.enabled) {
    return undefined;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (config.required) {
      throw new OnchainReasoningError("OPENAI_API_KEY is required for onchain semantic reasoning.");
    }
    return undefined;
  }
  return new OpenAIOnchainReasoner(new OpenAI({ apiKey }), config);
}

export function assertOnchainQueryAllowed(query: string): void {
  const text = query.toLowerCase();
  const blocked = [
    /\b(private key|seed phrase|mnemonic|recovery phrase|api key)\b/,
    /\b(sign|approve|swap|execute trade|custody)\b/,
    /\b(send|transfer)\s+(my\s+)?[0-9.,]+\s*(eth|usdc|usdt|btc|sol|token|tokens)\b/,
    /\b(buy|sell)\s+(with|for|using)\s+[0-9.,]+\b/,
    /\bguarantee(d)?\s+(profit|return)\b/,
    /\bexact\s+(price|profit|return)\b/,
  ];
  if (blocked.some((pattern) => pattern.test(text))) {
    throw new OnchainReasoningError("Request is outside read-only onchain intelligence scope.");
  }
}

export function applySemanticIntent(input: OnchainInput, plan: SemanticIntentPlan): OnchainInput {
  validateSemanticIntent(plan);
  return {
    ...input,
    query: plan.normalizedQuery.trim() || input.query,
    chain: plan.chain?.trim() || input.chain,
    scope: supportedScopes.includes(plan.scope) ? plan.scope : input.scope,
    timeframe: plan.timeframe?.trim() || input.timeframe,
    toolHints: sanitizeToolHints(plan.toolHints),
  };
}

export function applySemanticSynthesis(output: OnchainOutput, semantic: OnchainSemanticResult): OnchainOutput {
  const safe = sanitizeSemanticResult(semantic, output);
  return {
    ...output,
    answer: safe.summary,
    bullets: safe.keyFindings.map((finding) => finding.finding),
    recommendation: safe.agentReuse.decisionInputs[0] ?? output.recommendation,
    riskFlags: safe.risks.map((risk) => ({
      level: risk.severity === "high" ? "high" : risk.severity === "medium" ? "watch" : "info",
      label: risk.risk,
      detail: risk.mitigation,
    })),
    semantic: safe,
  };
}

class OpenAIOnchainReasoner implements OnchainReasoner {
  constructor(
    private readonly client: OpenAI,
    private readonly config: OnchainReasoningConfig
  ) {}

  async planIntent(input: OnchainInput): Promise<SemanticIntentPlan> {
    const prompt = limitInput(
      [
        "You are Langclaw's read-only onchain intelligence planner.",
        "Return only JSON that matches the schema.",
        "Classify the user's request into supported read-only onchain scope.",
        "Refuse any request to sign, approve, swap, transfer, custody funds, reveal secrets, or guarantee exact profit or price.",
        "Choose toolHints only from the allowlist.",
        "",
        `Tool allowlist: ${commandIds.join(", ")}`,
        `User input: ${JSON.stringify(redactSecrets(JSON.stringify(input)))}`,
      ].join("\n"),
      this.config.maxInputChars
    );
    return this.createJson<SemanticIntentPlan>("langclaw_onchain_intent", intentSchema(), prompt);
  }

  async synthesize(output: OnchainOutput): Promise<OnchainSemanticResult> {
    const evidence = {
      query: output.plan.intent.originalQuery,
      chain: output.plan.intent.chain.id,
      scope: output.plan.intent.scope,
      timeframe: output.plan.intent.timeframe,
      metrics: output.plan.intent.metrics,
      entities: output.plan.intent.entities,
      providerTrace: output.providerTrace.map((entry) => ({
        provider: entry.provider,
        status: entry.status,
        message: entry.message,
        sourceUrl: entry.sourceUrl,
      })),
      tools: output.tools.map((tool, index) => ({
        evidenceId: `onchain-source-${index + 1}`,
        title: tool.title,
        provider: tool.provider,
        status: tool.status,
        summary: tool.summary,
        sourceUrl: tool.sourceUrl,
      })),
      caveat: output.caveat,
      recommendation: output.recommendation,
    };
    const prompt = limitInput(
      [
        "You are Langclaw's onchain intelligence synthesis layer.",
        "Use only the provided evidence summaries and source URLs.",
        "Do not invent data, prices, labels, transactions, or sources.",
        "Return concise machine-readable JSON for another agent workflow.",
        "Keep every string short. Use at most 3 key findings, 5 signals, 3 risks, 3 opportunities, and 4 limitations.",
        "Do not mention any model, provider credential, internal prompt, or reasoning mode.",
        "",
        `Evidence: ${redactSecrets(JSON.stringify(evidence))}`,
      ].join("\n"),
      this.config.maxInputChars
    );
    return this.createJson<OnchainSemanticResult>("langclaw_onchain_synthesis", synthesisSchema(), prompt);
  }

  private async createJson<T>(name: string, schema: Record<string, unknown>, prompt: string): Promise<T> {
    const response = await retry(this.config.maxRetries, async () =>
      this.client.responses.create({
        input: prompt,
        max_output_tokens: this.config.maxOutputTokens,
        model: this.config.model,
        reasoning: { effort: this.config.reasoningEffort },
        text: {
          format: {
            name,
            schema,
            strict: true,
            type: "json_schema",
          },
        },
      } as never)
    );
    const text = (response as { output_text?: string }).output_text;
    if (!text) {
      throw new OnchainReasoningError("OpenAI response did not include JSON output.");
    }
    return JSON.parse(text) as T;
  }
}

function validateSemanticIntent(plan: SemanticIntentPlan): void {
  if (plan.safetyDecision === "refused") {
    throw new OnchainReasoningError(plan.refusalReason || "Request was refused by semantic planner.");
  }
  assertOnchainQueryAllowed(plan.normalizedQuery);
}

function sanitizeSemanticResult(result: OnchainSemanticResult, output: OnchainOutput): OnchainSemanticResult {
  const sourceIds = new Set(output.sourceUrls.map((_, index) => `onchain-source-${index + 1}`));
  const fallbackFinding = {
    finding: output.answer,
    confidence: output.confidence,
    whyItMatters: output.recommendation,
    evidenceIds: sourceIds.size ? [...sourceIds].slice(0, 3) : ["onchain-source-1"],
  };
  return {
    summary: textOr(result.summary, output.answer),
    keyFindings: result.keyFindings.length
      ? result.keyFindings.slice(0, 5).map((finding) => ({
          finding: textOr(finding.finding, fallbackFinding.finding),
          confidence: confidence(finding.confidence, output.confidence),
          whyItMatters: textOr(finding.whyItMatters, fallbackFinding.whyItMatters),
          evidenceIds: sanitizeEvidenceIds(finding.evidenceIds, sourceIds),
        }))
      : [fallbackFinding],
    signals: result.signals.slice(0, 8).map((signal) => ({
      name: textOr(signal.name, "Onchain signal"),
      category: textOr(signal.category, output.plan.intent.scope),
      strength: confidence(signal.strength, output.confidence),
      description: textOr(signal.description, "Signal derived from onchain provider summaries."),
    })),
    risks: result.risks.slice(0, 6).map((risk) => ({
      risk: textOr(risk.risk, "Limited evidence"),
      severity: confidence(risk.severity, "low"),
      mitigation: textOr(risk.mitigation, "Recheck source data before acting."),
    })),
    opportunities: result.opportunities.slice(0, 5).map((opportunity) => ({
      opportunity: textOr(opportunity.opportunity, output.recommendation),
      targetUse: targetUse(opportunity.targetUse),
    })),
    agentReuse: {
      recommendedUses: result.agentReuse.recommendedUses.map(targetUse).slice(0, 6),
      contentAngles: result.agentReuse.contentAngles.filter(Boolean).slice(0, 6),
      decisionInputs: result.agentReuse.decisionInputs.filter(Boolean).slice(0, 6),
    },
    limitations: result.limitations.length ? result.limitations.filter(Boolean).slice(0, 6) : [output.caveat],
  };
}

function sanitizeToolHints(value: OnchainCommandId[]): OnchainCommandId[] {
  const allowed = new Set(commandIds);
  return value.filter((hint): hint is OnchainCommandId => allowed.has(hint));
}

function sanitizeEvidenceIds(value: string[], sourceIds: Set<string>): string[] {
  const ids = value.filter((id) => sourceIds.has(id));
  return ids.length ? ids : sourceIds.size ? [...sourceIds].slice(0, 3) : ["onchain-source-1"];
}

function intentSchema(): Record<string, unknown> {
  return {
    additionalProperties: false,
    properties: {
      normalizedQuery: { maxLength: 240, type: "string" },
      chain: { maxLength: 40, type: "string" },
      scope: { enum: supportedScopes, type: "string" },
      entities: {
        items: {
          additionalProperties: false,
          properties: {
            type: { enum: ["chain", "token", "protocol", "wallet", "contract", "transaction", "bridge", "governance"], type: "string" },
            value: { maxLength: 120, type: "string" },
          },
          required: ["type", "value"],
          type: "object",
        },
        maxItems: 8,
        type: "array",
      },
      timeframe: { maxLength: 40, type: "string" },
      toolHints: { items: { enum: commandIds, type: "string" }, maxItems: 5, type: "array" },
      safetyDecision: { enum: ["safe", "needs-review", "refused"], type: "string" },
      refusalReason: { maxLength: 240, type: "string" },
    },
    required: ["normalizedQuery", "chain", "scope", "entities", "timeframe", "toolHints", "safetyDecision", "refusalReason"],
    type: "object",
  };
}

function synthesisSchema(): Record<string, unknown> {
  return {
    additionalProperties: false,
    properties: {
      summary: { maxLength: 360, type: "string" },
      keyFindings: {
        items: objectSchema({
          finding: shortString(),
          confidence: confidenceSchema(),
          whyItMatters: shortString(),
          evidenceIds: { items: { maxLength: 60, type: "string" }, maxItems: 4, type: "array" },
        }),
        maxItems: 3,
        type: "array",
      },
      signals: {
        items: objectSchema({
          name: shortString(),
          category: { maxLength: 60, type: "string" },
          strength: confidenceSchema(),
          description: shortString(),
        }),
        maxItems: 5,
        type: "array",
      },
      risks: {
        items: objectSchema({
          risk: shortString(),
          severity: confidenceSchema(),
          mitigation: shortString(),
        }),
        maxItems: 3,
        type: "array",
      },
      opportunities: {
        items: objectSchema({
          opportunity: shortString(),
          targetUse: { enum: supportedTargetUses, type: "string" },
        }),
        maxItems: 3,
        type: "array",
      },
      agentReuse: objectSchema({
        recommendedUses: { items: { enum: supportedTargetUses, type: "string" }, maxItems: 4, type: "array" },
        contentAngles: { items: shortString(), maxItems: 4, type: "array" },
        decisionInputs: { items: shortString(), maxItems: 4, type: "array" },
      }),
      limitations: { items: shortString(), maxItems: 4, type: "array" },
    },
    required: ["summary", "keyFindings", "signals", "risks", "opportunities", "agentReuse", "limitations"],
    type: "object",
  };
}

function objectSchema(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
    type: "object",
  };
}

function confidenceSchema(): Record<string, unknown> {
  return { enum: ["high", "medium", "low"], type: "string" };
}

function shortString(): Record<string, unknown> {
  return { maxLength: 180, type: "string" };
}

async function retry<T>(maxRetries: number, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function limitInput(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}\n[truncated]` : value;
}

function textOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function confidence(value: string | undefined, fallback: "high" | "medium" | "low"): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function targetUse(value: string | undefined): AgentTargetUse {
  return supportedTargetUses.includes(value as AgentTargetUse) ? (value as AgentTargetUse) : "agent-context";
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readReasoningEffort(value: string | undefined): ReasoningEffort {
  return value === "none" || value === "low" || value === "high" || value === "xhigh" ? value : "medium";
}

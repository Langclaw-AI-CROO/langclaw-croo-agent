import { stableHash } from "./hash.js";
import { runOnchainIntelligence } from "./onchain/workflow.js";
import { collectSources, createDefaultProviders } from "./providers.js";
import type { OnchainCommandId } from "./onchain/types.js";
import type { ProviderExecutor } from "./onchain/providers.js";
import type {
  Confidence,
  DeliveryProof,
  ProviderTraceEntry,
  ResearchInput,
  ResearchMode,
  ResearchOutput,
  ResearchProvider,
  SourceCard,
} from "./types.js";

export async function runCrooResearchAgent(
  input: ResearchInput,
  deps: {
    onchainExecutors?: Partial<Record<OnchainCommandId, ProviderExecutor>>;
    providers?: ResearchProvider[];
    now?: () => Date;
  } = {}
): Promise<ResearchOutput> {
  const normalized = normalizeInput(input);
  const now = deps.now ?? (() => new Date());

  if (normalized.mode === "onchain-intelligence") {
    const onchain = await runOnchainIntelligence({
      query: normalized.topic,
      chain: normalized.chain,
      scope: normalized.scope === "unknown" ? undefined : normalized.scope,
      tokenAddress: normalized.tokenAddress || undefined,
      walletAddress: normalized.walletAddress || undefined,
      contractAddress: normalized.contractAddress || undefined,
      transactionHash: normalized.transactionHash || undefined,
      timeframe: normalized.timeframe || undefined,
      responseLanguage: normalized.responseLanguage,
    }, { executors: deps.onchainExecutors });
    const sources = onchain.sourceUrls.map((url, index) => ({
      id: `onchain-source-${index + 1}`,
      title: `Onchain source ${index + 1}`,
      url,
      provider: "onchain",
      excerpt: "Provider source URL used by the onchain intelligence workflow.",
    }));
    const providerTrace = onchain.providerTrace.map((entry) => ({
      provider: entry.provider,
      status: entry.status,
      message: entry.message,
      sourceCount: entry.sourceUrl ? 1 : 0,
    }));
    const deliveryProof = buildDeliveryProof(normalized, sources, providerTrace, now());

    return {
      title: onchain.title,
      summary: onchain.answer,
      recommendation: onchain.recommendation,
      confidence: onchain.confidence,
      sources,
      providerTrace,
      deliveryProof,
      markdown: onchain.markdown,
      onchain,
    };
  }

  const providers = deps.providers ?? createDefaultProviders();
  const { sources, providerTrace } = await collectSources(normalized, providers);
  const confidence = estimateConfidence(sources, providerTrace);
  const title = buildTitle(normalized);
  const summary = buildSummary(normalized, sources);
  const recommendation = buildRecommendation(normalized, sources, confidence);
  const deliveryProof = buildDeliveryProof(normalized, sources, providerTrace, now());
  const markdown = renderMarkdown({
    title,
    input: normalized,
    summary,
    recommendation,
    confidence,
    sources,
    providerTrace,
    deliveryProof,
  });

  return {
    title,
    summary,
    recommendation,
    confidence,
    sources,
    providerTrace,
    deliveryProof,
    markdown,
  };
}

export function normalizeInput(input: ResearchInput): Required<ResearchInput> {
  const topic = input.topic?.trim();
  if (!topic) {
    throw new Error("topic is required");
  }

  return {
    topic,
    mode: input.mode ?? inferResearchMode(input, topic),
    chain: input.chain?.trim() || "multi-chain",
    responseLanguage:
      input.responseLanguage ?? readDefaultLanguage(process.env.LANGCLAW_DEFAULT_LANGUAGE),
    maxDepth: input.maxDepth ?? "standard",
    context: input.context?.trim() ?? "",
    scope: input.scope ?? "unknown",
    tokenAddress: input.tokenAddress?.trim() ?? "",
    walletAddress: input.walletAddress?.trim() ?? "",
    contractAddress: input.contractAddress?.trim() ?? "",
    transactionHash: input.transactionHash?.trim() ?? "",
    timeframe: input.timeframe?.trim() ?? "",
  };
}

function inferResearchMode(input: ResearchInput, topic: string): ResearchMode {
  if (
    input.scope ||
    input.tokenAddress ||
    input.walletAddress ||
    input.contractAddress ||
    input.transactionHash ||
    looksLikeOnchainPrompt(topic)
  ) {
    return "onchain-intelligence";
  }

  return "protocol-research";
}

function looksLikeOnchainPrompt(topic: string): boolean {
  const text = topic.toLowerCase();
  const hasAddress = /\b0x[a-f0-9]{40}\b/i.test(topic) || /\b0x[a-f0-9]{64}\b/i.test(topic);
  if (hasAddress) {
    return true;
  }

  return /\b(onchain|on-chain|wallet|contract|bytecode|transaction|tx hash|token holders?|holder flow|liquidity|pool|pair|dex|tvl|yield|apy|stablecoin|gas|fees|bridge|governance|proposal|token security|honeypot|approval risk|chain activity|active addresses)\b/.test(text);
}

function readDefaultLanguage(value: string | undefined): "en" | "id" {
  return value === "id" ? "id" : "en";
}

function estimateConfidence(
  sources: SourceCard[],
  providerTrace: ProviderTraceEntry[]
): Confidence {
  const successfulProviders = providerTrace.filter((entry) => entry.status === "success").length;
  if (sources.length >= 5 && successfulProviders >= 2) {
    return "high";
  }
  if (sources.length >= 2) {
    return "medium";
  }
  return "low";
}

function buildTitle(input: Required<ResearchInput>): string {
  const label = input.mode
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  return `${label}: ${input.topic}`;
}

function buildSummary(input: Required<ResearchInput>, sources: SourceCard[]): string {
  if (input.responseLanguage === "id") {
    if (!sources.length) {
      return `Langclaw membuat ringkasan awal untuk "${input.topic}", tetapi belum ada sumber live yang aktif.`;
    }
    return `Langclaw menemukan ${sources.length} sumber untuk "${input.topic}" dan menyusun ringkasan berdasarkan sinyal yang tersedia.`;
  }

  if (!sources.length) {
    return `Langclaw prepared an initial brief for "${input.topic}", but no live source provider returned evidence.`;
  }
  return `Langclaw found ${sources.length} source cards for "${input.topic}" and prepared a source-backed brief.`;
}

function buildRecommendation(
  input: Required<ResearchInput>,
  sources: SourceCard[],
  confidence: Confidence
): string {
  if (input.responseLanguage === "id") {
    if (confidence === "low") {
      return "Gunakan hasil ini sebagai draf awal. Tambahkan provider live sebelum keputusan penting.";
    }
    if (input.mode === "hackathon-fit") {
      return "Lanjutkan jika demo bisa menunjukkan agent callable, pembayaran, hasil riset, dan bukti delivery.";
    }
    return "Lanjutkan dengan validasi manual pada sumber utama sebelum dipakai untuk keputusan final.";
  }

  if (confidence === "low") {
    return "Use this as an initial draft. Configure live providers before making important decisions.";
  }
  if (input.mode === "hackathon-fit") {
    return "Proceed if the demo shows a callable agent, payment flow, research output, and delivery proof.";
  }
  return "Proceed after checking the primary sources that support the strongest claims.";
}

function buildDeliveryProof(
  input: Required<ResearchInput>,
  sources: SourceCard[],
  providerTrace: ProviderTraceEntry[],
  now: Date
): DeliveryProof {
  const generatedAt = now.toISOString();
  const inputHash = stableHash(input);
  const deliveryHash = stableHash({
    input,
    generatedAt,
    sources: sources.map((source) => ({
      title: source.title,
      url: source.url,
      provider: source.provider,
    })),
  });

  return {
    deliveryHash,
    generatedAt,
    inputHash,
    sourceCount: sources.length,
    executionLog: [
      "input-normalized",
      `providers-checked:${providerTrace.length}`,
      `sources-collected:${sources.length}`,
      "report-rendered",
      "delivery-proof-created",
    ],
  };
}

function renderMarkdown(args: {
  title: string;
  input: Required<ResearchInput>;
  summary: string;
  recommendation: string;
  confidence: Confidence;
  sources: SourceCard[];
  providerTrace: ProviderTraceEntry[];
  deliveryProof: DeliveryProof;
}): string {
  const lines = [
    `# ${args.title}`,
    "",
    `Mode: ${args.input.mode}`,
    `Scope: ${args.input.chain}`,
    `Confidence: ${args.confidence}`,
    "",
    "## Summary",
    args.summary,
    "",
    "## Recommendation",
    args.recommendation,
    "",
    "## Sources",
  ];

  if (!args.sources.length) {
    lines.push("No live sources were returned.");
  } else {
    for (const source of args.sources) {
      lines.push(`- ${source.title} (${source.provider}): ${source.url}`);
    }
  }

  lines.push("", "## Provider Trace");
  for (const entry of args.providerTrace) {
    lines.push(`- ${entry.provider}: ${entry.status}. ${entry.message}`);
  }

  lines.push(
    "",
    "## Delivery Proof",
    `- deliveryHash: ${args.deliveryProof.deliveryHash}`,
    `- inputHash: ${args.deliveryProof.inputHash}`,
    `- generatedAt: ${args.deliveryProof.generatedAt}`
  );

  return lines.join("\n");
}

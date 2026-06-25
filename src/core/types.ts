export type ResearchMode =
  | "hackathon-fit"
  | "protocol-research"
  | "claim-verification"
  | "market-brief"
  | "onchain-intelligence";

export type ResponseLanguage = "en" | "id";

export type ResearchDepth = "quick" | "standard" | "deep";

export type ResearchInput = {
  topic: string;
  mode?: ResearchMode;
  chain?: string;
  responseLanguage?: ResponseLanguage;
  maxDepth?: ResearchDepth;
  context?: string;
  scope?: import("./onchain/types.js").OnchainScope;
  tokenAddress?: string;
  walletAddress?: string;
  contractAddress?: string;
  transactionHash?: string;
  timeframe?: string;
};

export type SourceCard = {
  id: string;
  title: string;
  url: string;
  provider: string;
  excerpt: string;
  publishedAt?: string;
};

export type ProviderTraceEntry = {
  provider: string;
  status: "success" | "failed" | "skipped";
  message: string;
  sourceCount?: number;
};

export type Confidence = "high" | "medium" | "low";

export type DeliveryProof = {
  deliveryHash: string;
  generatedAt: string;
  inputHash: string;
  sourceCount: number;
  executionLog: string[];
};

export type ResearchOutput = {
  title: string;
  summary: string;
  recommendation: string;
  confidence: Confidence;
  sources: SourceCard[];
  providerTrace: ProviderTraceEntry[];
  deliveryProof: DeliveryProof;
  markdown: string;
  onchain?: import("./onchain/types.js").OnchainOutput;
};

export type ResearchProvider = {
  name: string;
  search(input: ResearchInput): Promise<SourceCard[]>;
};

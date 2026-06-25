import type { OnchainCommandId, OnchainPlan, OnchainToolResult } from "./types.js";
import { providerExecutors, type ProviderExecutor } from "./providers.js";

const cache = new Map<string, { expiresAt: number; result: OnchainToolResult }>();

export async function executeOnchainPlan(
  plan: OnchainPlan,
  deps: { executors?: Partial<Record<OnchainCommandId, ProviderExecutor>> } = {}
): Promise<OnchainToolResult[]> {
  const results: OnchainToolResult[] = [];
  const executors = { ...providerExecutors, ...deps.executors };

  for (const command of plan.commands) {
    const startedAt = Date.now();
    const cacheKey = JSON.stringify({
      id: command.id,
      chain: plan.intent.chain.id,
      query: plan.intent.rewrittenQuery,
      entities: plan.intent.entities,
    });
    const cached = readCache(cacheKey);
    if (cached) {
      results.push({ ...cached, latencyMs: 0, summary: `${cached.summary} Cache hit.` });
      continue;
    }

    const executor = executors[command.id];
    if (!executor) {
      results.push({
        commandId: command.id,
        title: command.title,
        provider: command.provider,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        summary: "Executor is not registered.",
        error: "Executor is not registered.",
      });
      continue;
    }

    try {
      const response = await runWithTimeout((signal) =>
        executor({
          chain: plan.intent.chain,
          query: plan.intent.originalQuery,
          tokenAddress: entity(plan, "token"),
          walletAddress: entity(plan, "wallet"),
          contractAddress: entity(plan, "contract"),
          transactionHash: entity(plan, "transaction"),
          previousSummaries: results.map((result) => result.summary),
          signal,
        })
      );
      const result: OnchainToolResult = {
        commandId: command.id,
        title: command.title,
        provider: command.provider,
        status: "success",
        latencyMs: Date.now() - startedAt,
        summary: response.summary,
        sourceUrl: response.sourceUrl ?? command.docsUrl,
        data: response.data,
        routeDebug: response.routeDebug,
      };
      writeCache(cacheKey, command.cacheTtlSeconds, result);
      results.push(result);
    } catch (error) {
      results.push({
        commandId: command.id,
        title: command.title,
        provider: command.provider,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        summary: error instanceof Error ? error.message : "Tool execution failed.",
        error: error instanceof Error ? error.message : "Tool execution failed.",
        sourceUrl: command.docsUrl,
      });
    }
  }

  return results;
}

function entity(plan: OnchainPlan, type: string): string | undefined {
  return plan.intent.entities.find((item) => item.type === type)?.value;
}

function readCache(key: string): OnchainToolResult | undefined {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return cached.result;
}

function writeCache(key: string, ttlSeconds: number, result: OnchainToolResult): void {
  if (ttlSeconds <= 0 || result.status !== "success") {
    return;
  }
  cache.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, result });
}

async function runWithTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const timeoutMs = Number.parseInt(process.env.LANGCLAW_ONCHAIN_TIMEOUT_MS ?? "15000", 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

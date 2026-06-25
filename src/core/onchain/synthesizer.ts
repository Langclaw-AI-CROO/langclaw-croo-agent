import { extractDuneSmartMoneyRows } from "./providers.js";
import type { OnchainOutput, OnchainPlan, OnchainToolResult, RiskFlag, SmartMoneyFlow, SmartMoneyInsight, SmartMoneyToken, SmartMoneyWallet } from "./types.js";

export function synthesizeOnchainOutput(plan: OnchainPlan, tools: OnchainToolResult[]): OnchainOutput {
  const successful = tools.filter((tool) => tool.status === "success");
  const failed = tools.filter((tool) => tool.status === "failed");
  const sourceUrls = Array.from(new Set(tools.map((tool) => tool.sourceUrl).filter((url): url is string => Boolean(url))));
  const confidence = successful.length >= 3 ? "high" : successful.length >= 1 ? "medium" : "low";
  const title = `${plan.intent.chain.name} ${labelForScope(plan.intent.scope)} Intelligence`;
  const smartMoney = buildSmartMoneyInsight(plan, tools);
  const bullets = buildBullets(plan, tools);
  const riskFlags = buildRiskFlags(plan, tools, smartMoney);
  const caveat = buildCaveat(plan, successful.length, failed.length);
  const recommendation = buildRecommendation(plan, confidence);
  const answer = smartMoney?.dataQuality.status === "ok"
    ? smartMoneySummary(smartMoney)
    : successful.length
    ? `Completed ${successful.length} onchain checks for ${plan.intent.originalQuery}.`
    : `No live onchain provider returned usable data for ${plan.intent.originalQuery}.`;
  const generatedAt = new Date().toISOString();
  const providerTrace = tools.map((tool) => ({
    provider: tool.provider,
    status: tool.status,
    message: tool.summary,
    sourceUrl: tool.sourceUrl,
    routeDebug: tool.routeDebug,
  }));
  const output: Omit<OnchainOutput, "markdown"> = {
    title,
    answer,
    bullets,
    recommendation,
    caveat,
    generatedAt,
    confidence,
    riskFlags,
    plan,
    tools,
    providerTrace,
    sourceUrls,
    smartMoney,
  };

  return {
    ...output,
    markdown: renderMarkdown(output),
  };
}

function buildBullets(plan: OnchainPlan, tools: OnchainToolResult[]): string[] {
  const bullets = tools
    .filter((tool) => tool.status === "success")
    .slice(0, 5)
    .map((tool) => `${tool.title}: ${tool.summary}`);

  if (!bullets.length) {
    bullets.push(`The route preserved ${plan.intent.scope} scope, but live data was unavailable.`);
  }

  for (const blocked of plan.blockedFallbacks.slice(0, 2)) {
    bullets.push(`Blocked fallback: ${blocked}`);
  }

  return bullets;
}

function buildRiskFlags(plan: OnchainPlan, tools: OnchainToolResult[], smartMoney?: SmartMoneyInsight): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (plan.intent.scope === "token" && !tools.some((tool) => tool.commandId.includes("security") && tool.status === "success")) {
    flags.push({
      level: "watch",
      label: "Token risk coverage gap",
      detail: "Token security provider data was not available or not configured.",
    });
  }
  if (plan.debug.finalStatus !== "planned") {
    flags.push({
      level: "info",
      label: "Limited route",
      detail: "The planner returned a limited route for this request.",
    });
  }
  if (tools.some((tool) => tool.status === "failed")) {
    flags.push({
      level: "watch",
      label: "Partial provider failure",
      detail: "At least one provider failed. Read provider trace before using the result.",
    });
  }
  if (smartMoney?.dataQuality.status === "ok") {
    flags.push({
      level: "watch",
      label: "No wallet labels",
      detail: "Wallets are raw addresses from Dune output and should be cross-checked before attribution.",
    });
    flags.push({
      level: "info",
      label: "Dune row limit",
      detail: `Delivery shows ${smartMoney.sourceRows.length} normalized row(s), capped for a compact buyer payload.`,
    });
  }
  return flags;
}

function buildSmartMoneyInsight(plan: OnchainPlan, tools: OnchainToolResult[]): SmartMoneyInsight | undefined {
  const duneTool = tools.find((tool) => tool.commandId === "dune.sql_execute");
  if (!duneTool) {
    return undefined;
  }
  const routeDebug = duneTool.routeDebug ?? {};
  const chain = stringValue(routeDebug.selectedChain) || plan.intent.chain.id;
  if (duneTool.status !== "success") {
    return {
      accumulatedTokens: [],
      chain,
      dataQuality: {
        chain,
        minUsd: numberValue(routeDebug.minUsd) || undefined,
        notes: [duneTool.error || duneTool.summary || "Dune smart-money provider was unavailable."],
        returnedRows: 0,
        route: stringValue(routeDebug.generatedRoute) || "dune.sql_execute",
        status: "unavailable",
        windowDays: numberValue(routeDebug.windowDays) || undefined,
      },
      flows: [],
      minUsd: numberValue(routeDebug.minUsd) || undefined,
      sourceRows: [],
      timeframe: plan.intent.timeframe,
      topWallets: [],
    };
  }
  const sourceRows = extractDuneSmartMoneyRows(duneTool.data, 10).map((row, index) => ({
    ...row,
    evidenceId: `smart-money-row-${index + 1}`,
  }));
  const dataQuality = {
    chain,
    minUsd: numberValue(routeDebug.minUsd) || undefined,
    notes: sourceRows.length
      ? ["Rows are normalized from Dune dex.trades output.", "Wallet labels are not inferred."]
      : ["Dune execution completed, but no qualifying rows were returned for the selected filters."],
    returnedRows: sourceRows.length,
    route: stringValue(routeDebug.generatedRoute) || undefined,
    status: sourceRows.length ? "ok" as const : "no_rows_returned" as const,
    windowDays: numberValue(routeDebug.windowDays) || undefined,
  };
  return {
    accumulatedTokens: aggregateTokens(sourceRows),
    chain,
    dataQuality,
    flows: sourceRows,
    minUsd: dataQuality.minUsd,
    sourceRows,
    timeframe: plan.intent.timeframe,
    topWallets: aggregateWallets(sourceRows),
  };
}

function aggregateWallets(rows: SmartMoneyFlow[]): SmartMoneyWallet[] {
  const byWallet = new Map<string, { netUsd: number; tradeCount: number; tokens: Set<string> }>();
  for (const row of rows) {
    const existing = byWallet.get(row.wallet) ?? { netUsd: 0, tradeCount: 0, tokens: new Set<string>() };
    existing.netUsd += row.netUsd;
    existing.tradeCount += row.trades;
    existing.tokens.add(row.tokenSymbol);
    byWallet.set(row.wallet, existing);
  }
  return [...byWallet.entries()]
    .map(([wallet, value]) => ({
      netUsd: roundUsd(value.netUsd),
      tokenCount: value.tokens.size,
      tokens: [...value.tokens].sort(),
      tradeCount: value.tradeCount,
      wallet,
    }))
    .sort((left, right) => right.netUsd - left.netUsd)
    .slice(0, 10);
}

function aggregateTokens(rows: SmartMoneyFlow[]): SmartMoneyToken[] {
  const byToken = new Map<string, { netUsd: number; tokenAddress?: string; tradeCount: number; wallets: Set<string> }>();
  for (const row of rows) {
    const key = row.tokenAddress || row.tokenSymbol;
    const existing = byToken.get(key) ?? { netUsd: 0, tokenAddress: row.tokenAddress, tradeCount: 0, wallets: new Set<string>() };
    existing.netUsd += row.netUsd;
    existing.tradeCount += row.trades;
    existing.wallets.add(row.wallet);
    byToken.set(key, existing);
  }
  return [...byToken.entries()]
    .map(([key, value]) => ({
      netUsd: roundUsd(value.netUsd),
      tokenAddress: value.tokenAddress,
      tokenSymbol: rows.find((row) => (row.tokenAddress || row.tokenSymbol) === key)?.tokenSymbol ?? key,
      tradeCount: value.tradeCount,
      walletCount: value.wallets.size,
    }))
    .sort((left, right) => right.netUsd - left.netUsd)
    .slice(0, 10);
}

function smartMoneySummary(smartMoney: SmartMoneyInsight): string {
  const walletCount = smartMoney.topWallets.length;
  const tokenCount = smartMoney.accumulatedTokens.length;
  const totalUsd = roundUsd(smartMoney.sourceRows.reduce((sum, row) => sum + row.netUsd, 0));
  return `Found ${smartMoney.sourceRows.length} visible smart-money accumulation row(s) on ${smartMoney.chain}, covering ${walletCount} wallet(s), ${tokenCount} token(s), and ${formatUsd(totalUsd)} in net buy flow.`;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function buildCaveat(plan: OnchainPlan, successCount: number, failedCount: number): string {
  if (plan.intent.unsupportedChain) {
    return `${plan.intent.unsupportedChain.name} is not configured in this onchain route.`;
  }
  if (!successCount) {
    return "No live provider returned data. The answer preserves scope and does not substitute unrelated data.";
  }
  if (failedCount) {
    return "Some providers failed. Treat this as partial evidence.";
  }
  return "This is read-only analytics, not transaction advice.";
}

function buildRecommendation(plan: OnchainPlan, confidence: string): string {
  if (confidence === "low") {
    return "Add provider keys or a more specific entity before using this result for decisions.";
  }
  if (plan.intent.scope === "token") {
    return "Review liquidity, holder, and risk provider output together before ranking the token.";
  }
  if (plan.intent.scope === "wallet") {
    return "Review transfers and balances together before making wallet behavior claims.";
  }
  return "Use the source URLs and provider trace to validate the strongest signals.";
}

function renderMarkdown(output: Omit<OnchainOutput, "markdown">): string {
  const lines = [
    `# ${output.title}`,
    "",
    `Scope: ${output.plan.intent.scope}`,
    `Chain: ${output.plan.intent.chain.name}`,
    `Confidence: ${output.confidence}`,
    "",
    "## Answer",
    output.answer,
    "",
    "## Signals",
    ...output.bullets.map((item) => `- ${item}`),
    "",
    "## Recommendation",
    output.recommendation,
    "",
    "## Caveat",
    output.caveat,
    "",
    "## Provider Trace",
    ...output.providerTrace.map((entry) => `- ${entry.provider}: ${entry.status}. ${entry.message}`),
  ];

  if (output.sourceUrls.length) {
    lines.push("", "## Source URLs", ...output.sourceUrls.map((url) => `- ${url}`));
  }

  const routeDebugLines = output.providerTrace
    .filter((entry) => entry.routeDebug)
    .map((entry) => `- ${entry.provider}: ${formatRouteDebug(entry.routeDebug ?? {})}`);

  if (routeDebugLines.length) {
    lines.push("", "## Route Debug", ...routeDebugLines);
  }

  return lines.join("\n");
}

function formatRouteDebug(debug: Record<string, unknown>): string {
  const preferredKeys = [
    "generatedRoute",
    "selectedChain",
    "tableFamily",
    "minUsd",
    "windowDays",
    "tokenSymbol",
    "executionId",
    "executionCostCredits",
  ];
  return preferredKeys
    .filter((key) => debug[key] !== undefined && debug[key] !== "")
    .map((key) => `${key}=${String(debug[key])}`)
    .join(", ");
}

function labelForScope(scope: string): string {
  return scope
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

import type { OnchainOutput, OnchainPlan, OnchainToolResult, RiskFlag } from "./types.js";

export function synthesizeOnchainOutput(plan: OnchainPlan, tools: OnchainToolResult[]): OnchainOutput {
  const successful = tools.filter((tool) => tool.status === "success");
  const failed = tools.filter((tool) => tool.status === "failed");
  const sourceUrls = Array.from(new Set(tools.map((tool) => tool.sourceUrl).filter((url): url is string => Boolean(url))));
  const confidence = successful.length >= 3 ? "high" : successful.length >= 1 ? "medium" : "low";
  const title = `${plan.intent.chain.name} ${labelForScope(plan.intent.scope)} Intelligence`;
  const bullets = buildBullets(plan, tools);
  const riskFlags = buildRiskFlags(plan, tools);
  const caveat = buildCaveat(plan, successful.length, failed.length);
  const recommendation = buildRecommendation(plan, confidence);
  const answer = successful.length
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

function buildRiskFlags(plan: OnchainPlan, tools: OnchainToolResult[]): RiskFlag[] {
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
  return flags;
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

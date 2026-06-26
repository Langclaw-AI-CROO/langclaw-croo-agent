import "dotenv/config";

import { promises as fs } from "node:fs";
import path from "node:path";

import { redactSecrets } from "../src/core/redact.js";
import type { CrooOrderEvidence } from "../src/croo/evidence.js";

type RequesterSmokeSummary = {
  capabilityId?: string;
  command?: string;
  deliverTxHash?: string;
  deliveryId?: string;
  deliveryPreviewHash?: string;
  deliveryStatus?: string;
  generatedAt?: string;
  negotiationId?: string;
  orderId?: string;
  orderStatus?: string;
  paid?: boolean;
  payTxHash?: string;
  providerAgentId?: string;
  requesterAgentId?: string;
  requesterWalletAddress?: string;
  serviceId?: string;
};

async function main(): Promise<void> {
  const evidencePath = path.resolve(process.env.LANGCLAW_CROO_EVIDENCE_LOG_PATH?.trim() || path.join("data", "croo-order-evidence.jsonl"));
  const smokePath = path.resolve(process.env.CROO_REQUESTER_SMOKE_OUTPUT_PATH?.trim() || path.join("data", "croo-requester-smoke.json"));
  const a2aWorkbenchPath = path.resolve(
    process.env.CROO_A2A_WORKBENCH_SMOKE_OUTPUT_PATH?.trim() || path.join("data", "croo-a2a-workbench-smoke.json")
  );
  const reportPath = path.resolve(process.env.CROO_LIVE_EVIDENCE_REPORT_PATH?.trim() || path.join("docs", "CROO_LIVE_EVIDENCE.md"));

  const evidence = await readEvidence(evidencePath);
  const smoke = await readRequesterSmoke(smokePath);
  const a2aWorkbench = await readRequesterSmoke(a2aWorkbenchPath);
  const markdown = buildReport({
    a2aWorkbench,
    a2aWorkbenchPath,
    evidence,
    evidencePath,
    generatedAt: new Date().toISOString(),
    reportPath,
    smoke,
    smokePath,
  });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote ${reportPath}`);
}

function buildReport(input: {
  a2aWorkbench?: RequesterSmokeSummary;
  a2aWorkbenchPath: string;
  evidence: CrooOrderEvidence[];
  evidencePath: string;
  generatedAt: string;
  reportPath: string;
  smoke?: RequesterSmokeSummary;
  smokePath: string;
}): string {
  const delivered = input.evidence.filter((record) => record.stage === "order_delivered");
  const failed = input.evidence.filter((record) => record.stage === "order_failed");
  const integratedA2a = input.evidence.filter((record) => record.stage.startsWith("a2a_workbench_"));
  const integratedA2aCompleted = unique(
    integratedA2a.filter((record) => record.stage === "a2a_workbench_delivery_received").map((record) => record.a2aOrderId)
  );
  const completedOrderIds = unique(delivered.map((record) => record.orderId));
  const negotiationIds = unique(input.evidence.map((record) => record.negotiationId));
  const deliveryHashes = unique(delivered.map((record) => record.deliveryHash));
  const requesterIds = unique([input.smoke?.requesterAgentId, input.a2aWorkbench?.requesterAgentId]);
  const requesterWallets = unique([input.smoke?.requesterWalletAddress, input.a2aWorkbench?.requesterWalletAddress]);
  const commands = unique([
    input.smoke?.command,
    input.a2aWorkbench?.command,
    "node --import tsx scripts/croo-evidence-report.ts",
  ]);

  return [
    "# CROO Live Evidence",
    "",
    `Generated at: ${input.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Completed order count: ${completedOrderIds.length}`,
    `- Unique requester agent count: ${requesterIds.length}`,
    `- Unique requester wallet count: ${requesterWallets.length}`,
    `- Failed lifecycle event count: ${failed.length}`,
    `- A2A partner completed order count: ${input.a2aWorkbench?.orderStatus === "completed" ? 1 : 0}`,
    `- Integrated A2A Workbench completed order count: ${integratedA2aCompleted.length}`,
    `- Evidence log: \`${path.relative(process.cwd(), input.evidencePath)}\``,
    `- Requester smoke summary: \`${path.relative(process.cwd(), input.smokePath)}\``,
    `- A2A Workbench smoke summary: \`${path.relative(process.cwd(), input.a2aWorkbenchPath)}\``,
    "",
    "## Completed Orders",
    "",
    table(
      ["Order ID", "Negotiation ID", "Service ID", "Capability", "Settlement", "Delivery Hash", "Sources", "Timestamp"],
      delivered.map((record) => [
        record.orderId ?? "",
        record.negotiationId ?? "",
        record.serviceId ?? "",
        record.capabilityId ?? "",
        record.settlementMode ?? "",
        record.deliveryHash ?? "",
        record.sourceCount === undefined ? "" : String(record.sourceCount),
        record.generatedAt,
      ])
    ),
    "",
    "## Lifecycle Events",
    "",
    table(
      ["Stage", "Order ID", "Negotiation ID", "Service ID", "Capability", "Settlement", "Timestamp"],
      input.evidence.map((record) => [
        record.stage,
        record.orderId ?? "",
        record.negotiationId ?? "",
        record.serviceId ?? "",
        record.capabilityId ?? "",
        record.settlementMode ?? "",
        record.generatedAt,
      ])
    ),
    "",
    "## Integrated A2A Workbench Proof",
    "",
    integratedA2a.length
      ? table(
          [
            "Stage",
            "Langclaw Order ID",
            "Workbench Negotiation ID",
            "Workbench Order ID",
            "Workbench Service ID",
            "Provider Agent ID",
            "Delivery Hash",
            "Timestamp",
          ],
          integratedA2a.map((record) => [
            record.stage,
            record.orderId ?? "",
            record.a2aNegotiationId ?? "",
            record.a2aOrderId ?? "",
            record.a2aServiceId ?? "",
            record.a2aProviderAgentId ?? "",
            record.deliveryHash ?? "",
            record.generatedAt,
          ])
        )
      : "No integrated A2A Workbench events were captured in the Langclaw order evidence. Use the partner proof below, or enable `LANGCLAW_A2A_WORKBENCH_ENABLED=true` for the next paid onchain smoke.",
    "",
    "## A2A Partner Proof",
    "",
    table(
      ["Field", "Value"],
      [
        ["Capability", display(input.a2aWorkbench?.capabilityId, "Not captured in standalone A2A smoke summary.")],
        ["Requester agent ID", display(input.a2aWorkbench?.requesterAgentId, "Not captured in standalone A2A smoke summary.")],
        ["Provider agent ID", display(input.a2aWorkbench?.providerAgentId, "Not captured in standalone A2A smoke summary.")],
        ["Service ID", display(input.a2aWorkbench?.serviceId, "Not captured in standalone A2A smoke summary.")],
        ["Negotiation ID", display(input.a2aWorkbench?.negotiationId, "Not captured in standalone A2A smoke summary.")],
        ["Order ID", display(input.a2aWorkbench?.orderId, "Not captured in standalone A2A smoke summary.")],
        ["Order status", display(input.a2aWorkbench?.orderStatus, "Not captured in standalone A2A smoke summary.")],
        ["Paid", input.a2aWorkbench?.paid === undefined ? "Not captured in standalone A2A smoke summary." : String(input.a2aWorkbench.paid)],
        ["Pay tx hash", display(input.a2aWorkbench?.payTxHash, "Not captured in standalone A2A smoke summary.")],
        ["Deliver tx hash", display(input.a2aWorkbench?.deliverTxHash, "Not captured in standalone A2A smoke summary.")],
        ["Delivery ID", display(input.a2aWorkbench?.deliveryId, "Not captured in standalone A2A smoke summary.")],
        ["Delivery status", display(input.a2aWorkbench?.deliveryStatus, "Not captured in standalone A2A smoke summary.")],
        ["Delivery preview hash", display(input.a2aWorkbench?.deliveryPreviewHash, "Not captured in standalone A2A smoke summary.")],
        ["Generated at", display(input.a2aWorkbench?.generatedAt, "Not captured in standalone A2A smoke summary.")],
      ]
    ),
    "",
    "## Requester Proof",
    "",
    table(
      ["Field", "Value"],
      [
        ["Requester agent ID", display(input.smoke?.requesterAgentId, "Not captured in requester smoke summary.")],
        ["Requester wallet", display(input.smoke?.requesterWalletAddress, "Not captured in requester smoke summary.")],
        ["Service ID", display(input.smoke?.serviceId, "Not captured in requester smoke summary.")],
        ["Smoke negotiation ID", display(input.smoke?.negotiationId, "Not captured in requester smoke summary.")],
        ["Smoke order ID", display(input.smoke?.orderId, "Not captured in requester smoke summary.")],
      ]
    ),
    "",
    "## Anti-Sybil Notes",
    "",
    `- Unique requester agents captured: ${requesterIds.length}.`,
    `- Unique requester wallets captured: ${requesterWallets.length}.`,
    "- Use real requester agents and buyer wallets for final proof.",
    "- Keep provider and requester keys separate.",
    "- Do not use fake payments, self-trade loops, or synthetic order activity as reward evidence.",
    "- Keep redacted logs available for random human audit.",
    "",
    "## Commands",
    "",
    ...commands.map((command) => `- \`${command}\``),
    "",
    "## Notes",
    "",
    "- This report is generated from redacted local evidence files.",
    "- It intentionally omits raw prompts, API keys, license tokens, private keys, and full delivery payloads.",
    "",
  ].join("\n");
}

async function readEvidence(filePath: string): Promise<CrooOrderEvidence[]> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CrooOrderEvidence);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

async function readRequesterSmoke(filePath: string): Promise<RequesterSmokeSummary | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as RequesterSmokeSummary;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function table(headers: string[], rows: string[][]): string {
  const safeRows = rows.length ? rows : [headers.map(() => "")];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...safeRows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function display(value: string | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function escapeCell(value: string): string {
  return redactSecrets(value.replace(/\|/g, "\\|"));
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

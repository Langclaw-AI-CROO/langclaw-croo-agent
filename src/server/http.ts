import "dotenv/config";

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { getReadiness } from "../core/readiness.js";
import { LicenseStore } from "../license/store.js";
import type { LicenseValidationResult } from "../license/types.js";
import { createMcpServer, LANGCLAW_TOOL_DEFINITIONS } from "../mcp/server.js";

export type HostedServerOptions = {
  accessTokens?: string[];
  licenseStore?: LicenseStore;
  publicUrl?: string;
};

type JsonValue = Record<string, unknown> | Array<unknown>;

export function createHostedHttpServer(options: HostedServerOptions = {}): Server {
  const accessTokens = options.accessTokens ?? readAccessTokens();
  const licenseStore = options.licenseStore ?? new LicenseStore();
  const publicUrl = options.publicUrl ?? process.env.LANGCLAW_PUBLIC_URL ?? "";

  return createServer(async (request, response) => {
    try {
      setCommonHeaders(response);

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "ok",
          name: "langclaw-croo-agent",
          publicUrl,
          uptimeSeconds: Math.round(process.uptime()),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/readiness") {
        sendJson(response, 200, getReadiness());
        return;
      }

      if (request.method === "GET" && url.pathname === "/tools") {
        sendJson(response, 200, {
          name: "langclaw-croo-agent",
          mcpEndpoint: publicUrl ? `${publicUrl.replace(/\/$/, "")}/mcp` : "/mcp",
          tools: LANGCLAW_TOOL_DEFINITIONS,
        });
        return;
      }

      if (url.pathname === "/mcp") {
        const parsedBody = request.method === "POST" ? await readJsonBody(request) : undefined;
        const auth = checkAuth(request, accessTokens, licenseStore, countToolCalls(parsedBody));
        if (!auth.ok) {
          sendJson(response, auth.status, { error: auth.message });
          return;
        }
        const mcpServer = createMcpServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await mcpServer.connect(transport);
        await transport.handleRequest(request, response, parsedBody);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      if (!response.headersSent) {
        sendJson(response, 500, { error: message });
        return;
      }
      response.end();
    }
  });
}

export function readAccessTokens(value = `${process.env.LANGCLAW_ADMIN_ACCESS_TOKENS ?? ""},${process.env.LANGCLAW_ACCESS_TOKENS ?? ""}`): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function checkAuth(
  request: IncomingMessage,
  accessTokens: string[],
  licenseStore: LicenseStore,
  toolCallCount: number
): { ok: true } | { ok: false; status: number; message: string } {
  const token = readBearerToken(request) ?? readHeaderToken(request);
  if (!token) {
    return { ok: false, status: 401, message: "Missing access token." };
  }

  if (accessTokens.includes(token)) {
    return { ok: true };
  }

  return mapLicenseAuth(toolCallCount > 0 ? licenseStore.validateAndConsume(token, new Date(), toolCallCount) : licenseStore.validate(token));
}

function mapLicenseAuth(result: LicenseValidationResult): { ok: true } | { ok: false; status: number; message: string } {
  if (result.ok) {
    return { ok: true };
  }
  if (result.reason === "expired") {
    return { ok: false, status: 403, message: `License token expired at ${result.record?.expiresAt ?? "unknown"}. Renew through CROO.` };
  }
  if (result.reason === "revoked") {
    return { ok: false, status: 403, message: "License token has been revoked." };
  }
  if (result.reason === "over_limit") {
    return { ok: false, status: 429, message: "License token call limit reached. Renew through CROO." };
  }
  return { ok: false, status: 403, message: "Invalid access token." };
}

function readBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header) {
    return undefined;
  }
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function readHeaderToken(request: IncomingMessage): string | undefined {
  const header = request.headers["x-langclaw-token"];
  return typeof header === "string" && header.trim() ? header.trim() : undefined;
}

function countToolCalls(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countToolCalls(item), 0);
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  return (value as { method?: unknown }).method === "tools/call" ? 1 : 0;
}

function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization,content-type,mcp-protocol-version,x-langclaw-token");
}

function sendJson(response: ServerResponse, statusCode: number, value: JsonValue): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(value, null, 2));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.LANGCLAW_SERVER_PORT ?? "8787", 10);
  const server = createHostedHttpServer();
  server.listen(port, () => {
    console.log(`Langclaw hosted MCP server listening on ${port}`);
  });
}

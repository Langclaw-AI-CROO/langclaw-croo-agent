#!/usr/bin/env node

import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { helpText, parseClientOptions, redactErrorMessage, validateClientOptions } from "./config.js";
import {
  generateCodexMcpToml,
  generateMcpConfigJson,
  installClaude,
  installCodex,
  installJsonMcpClient,
  uninstallClaude,
  uninstallCodex,
  uninstallJsonMcpClient,
} from "./installer.js";

const options = parseClientOptions(process.argv.slice(2));
if (options.help) {
  console.log(helpText());
  process.exit(0);
}

const errors = validateClientOptions(options);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

if (options.command === "install-codex") {
  try {
    const result = installCodex({
      installPlugin: options.installPlugin,
      token: options.token,
      url: options.url,
    });
    console.log(`Installed Langclaw MCP config: ${result.configPath}`);
    console.log(`Installed Langclaw skill: ${result.skillPath}`);
    if (result.pluginPath) {
      console.log(`Installed Langclaw plugin: ${result.pluginPath}`);
    }
    if (result.backupPath) {
      console.log(`Backup written: ${result.backupPath}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(redactErrorMessage(error));
    process.exit(1);
  }
}

if (options.command === "print-codex-config") {
  console.log(generateCodexMcpToml(options.url, options.token));
  process.exit(0);
}

if (options.command === "print-mcp-config") {
  console.log(generateMcpConfigJson(options.url, options.token));
  process.exit(0);
}

if (options.command === "install-claude") {
  const result = installClaude(options.url, options.token);
  console.log(redactErrorMessage(result.message));
  if (!result.installed) {
    console.log(redactErrorMessage(`Manual command: ${result.command}`));
  }
  process.exit(result.installed ? 0 : 1);
}

if (options.command === "install-cursor" || options.command === "install-windsurf") {
  const client = options.command === "install-cursor" ? "cursor" : "windsurf";
  try {
    const result = installJsonMcpClient(client, {
      token: options.token,
      url: options.url,
    });
    console.log(`Installed Langclaw ${client} MCP config: ${result.configPath}`);
    if (result.backupPath) {
      console.log(`Backup written: ${result.backupPath}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(redactErrorMessage(error));
    console.log("Manual MCP config:");
    console.log(generateMcpConfigJson(options.url, "[redacted-token]"));
    process.exit(1);
  }
}

if (options.command === "uninstall-codex") {
  try {
    const result = uninstallCodex();
    console.log(`Updated Codex config: ${result.configPath}`);
    console.log(`Removed Langclaw skill: ${result.removedSkill ? "yes" : "not found"}`);
    console.log(`Removed Langclaw plugin: ${result.removedPlugin ? "yes" : "not found"}`);
    process.exit(0);
  } catch (error) {
    console.error(redactErrorMessage(error));
    process.exit(1);
  }
}

if (options.command === "uninstall-claude") {
  const result = uninstallClaude();
  console.log(redactErrorMessage(result.message));
  process.exit(result.installed ? 0 : 1);
}

if (options.command === "uninstall-cursor" || options.command === "uninstall-windsurf") {
  const client = options.command === "uninstall-cursor" ? "cursor" : "windsurf";
  try {
    const result = uninstallJsonMcpClient(client);
    console.log(`Updated ${client} MCP config: ${result.configPath}`);
    console.log(`Removed Langclaw server: ${result.removed ? "yes" : "not found"}`);
    process.exit(0);
  } catch (error) {
    console.error(redactErrorMessage(error));
    process.exit(1);
  }
}

const transport = new StreamableHTTPClientTransport(new URL(options.url), {
  requestInit: {
    headers: {
      authorization: `Bearer ${options.token}`,
    },
  },
  fetch: createTimeoutFetch(options.timeoutMs),
});

transport.onmessage = (message) => {
  process.stdout.write(serializeMessage(message));
};

transport.onerror = (error) => {
  console.error(redactErrorMessage(error));
};

transport.onclose = () => {
  process.exit(0);
};

try {
  await transport.start();
} catch (error) {
  console.error(redactErrorMessage(error));
  process.exit(1);
}

const readBuffer = new ReadBuffer();
process.stdin.on("data", async (chunk: Buffer) => {
  readBuffer.append(chunk);
  let message: JSONRPCMessage | null;
  while ((message = readBuffer.readMessage())) {
    try {
      await transport.send(message);
    } catch (error) {
      writeSendError(message, error);
    }
  }
});

process.stdin.on("end", async () => {
  await transport.close();
});

function createTimeoutFetch(timeoutMs: number): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function writeSendError(message: JSONRPCMessage, error: unknown): void {
  if ("id" in message && message.id !== undefined) {
    process.stdout.write(
      serializeMessage({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: redactErrorMessage(error),
        },
      })
    );
    return;
  }
  console.error(redactErrorMessage(error));
}

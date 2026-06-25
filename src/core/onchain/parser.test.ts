import assert from "node:assert/strict";
import test from "node:test";

import { parseOnchainIntent } from "./parser.js";

test("parser keeps chain activity scope", () => {
  const intent = parseOnchainIntent({ query: "Base chain activity today" });

  assert.equal(intent.scope, "chain");
  assert.equal(intent.chain.id, "base");
  assert.equal(intent.debug.preservationCheck, "preserved");
});

test("parser keeps token liquidity scope", () => {
  const intent = parseOnchainIntent({
    query: "BASE token liquidity on Base",
    tokenAddress: "0x0000000000000000000000000000000000000001",
  });

  assert.equal(intent.scope, "token");
  assert.equal(intent.chain.id, "base");
  assert.ok(intent.metrics.includes("liquidity"));
});

test("parser detects wallet, contract, transaction, bridge, and unsupported chain cases", () => {
  const wallet = parseOnchainIntent({
    query: "wallet portfolio 0x0000000000000000000000000000000000000001",
  });
  const contract = parseOnchainIntent({
    query: "contract bytecode 0x0000000000000000000000000000000000000002",
  });
  const transaction = parseOnchainIntent({
    query: "transaction 0x0000000000000000000000000000000000000000000000000000000000000003",
  });
  const bridge = parseOnchainIntent({ query: "bridge route from Base to Ethereum" });
  const unsupported = parseOnchainIntent({ query: "Monad chain activity today" });

  assert.equal(wallet.scope, "wallet");
  assert.equal(contract.scope, "contract");
  assert.equal(transaction.scope, "transaction");
  assert.equal(bridge.scope, "bridge");
  assert.equal(unsupported.unsupportedChain?.id, "monad");
});

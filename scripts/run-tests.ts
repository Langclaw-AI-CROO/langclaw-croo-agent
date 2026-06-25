import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const roots = ["src", "packages"];
const testFiles = roots.flatMap((root) => collectTests(path.resolve(root))).sort();

if (!testFiles.length) {
  console.error("No test files found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);

function collectTests(target: string): string[] {
  if (!fs.existsSync(target)) {
    return [];
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return target.endsWith(".test.ts") ? [target] : [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(target)
    .filter((entry) => entry !== "node_modules" && entry !== "dist")
    .flatMap((entry) => collectTests(path.join(target, entry)));
}

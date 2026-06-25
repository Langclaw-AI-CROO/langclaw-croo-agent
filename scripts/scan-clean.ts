import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2];
const roots = [
  ".env.example",
  ".gitignore",
  "AGENTS.md",
  "README.md",
  "docs",
  "package.json",
  "package-lock.json",
  "plugin",
  "packages",
  "scripts",
  "skill",
  "src",
  "tsconfig.json",
  "LICENSE",
  ".github",
];

const legacyTerms = [
  ["Su", "i"].join(""),
  ["Wal", "rus"].join(""),
  ["Se", "al"].join(""),
  ["Mo", "ve"].join(""),
  ["Mem", "Wal"].join(""),
  ["SU", "I_"].join(""),
  ["WAL", "RUS_"].join(""),
  ["SE", "AL_"].join(""),
  ["private", "memory"].join(" "),
];

const dashTerms = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
const secretTerms = [
  /sk-proj-[A-Za-z0-9_-]+/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /croo_sk_(?!\[redacted\]|\*{4})[A-Za-z0-9]+/,
  /lc_live_(?!\[redacted\]|xxx\b|test\b)[A-Za-z0-9_-]+/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const terms: Array<string | RegExp> = mode === "cleanup" ? legacyTerms : mode === "dash" ? dashTerms : mode === "secrets" ? secretTerms : [];

if (!terms.length) {
  console.error("Usage: scan-clean.ts cleanup|dash|secrets");
  process.exit(2);
}

const matches: string[] = [];

for (const root of roots) {
  scanPath(path.resolve(root));
}

if (matches.length) {
  console.error(matches.join("\n"));
  process.exit(1);
}

function scanPath(target: string): void {
  if (!fs.existsSync(target)) {
    return;
  }

  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") {
        continue;
      }
      scanPath(path.join(target, entry));
    }
    return;
  }

  if (!stat.isFile()) {
    return;
  }
  if (mode === "secrets" && /\.test\.ts$/.test(target)) {
    return;
  }

  const text = fs.readFileSync(target, "utf8");
  const lines = text.split(/\n/);
  lines.forEach((line, index) => {
    for (const term of terms) {
      if (typeof term === "string" ? line.includes(term) : term.test(line)) {
        matches.push(`${path.relative(process.cwd(), target)}:${index + 1}: matched restricted term`);
      }
    }
  });
}

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
const terms = mode === "cleanup" ? legacyTerms : mode === "dash" ? dashTerms : [];

if (!terms.length) {
  console.error("Usage: scan-clean.ts cleanup|dash");
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

  const text = fs.readFileSync(target, "utf8");
  const lines = text.split(/\n/);
  lines.forEach((line, index) => {
    for (const term of terms) {
      if (line.includes(term)) {
        matches.push(`${path.relative(process.cwd(), target)}:${index + 1}: matched restricted term`);
      }
    }
  });
}

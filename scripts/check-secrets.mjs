import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);
const patterns = [
  {
    name: "private key",
    expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  { name: "AWS access key", expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", expression: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
];
const findings = [];
for (const file of files)
  for (const pattern of patterns)
    if (pattern.expression.test(readFileSync(resolve(root, file), "utf8")))
      findings.push(`${file}: ${pattern.name}`);
if (findings.length > 0)
  throw new Error(`Potential committed secrets:\n${findings.join("\n")}`);
console.log("Secret-pattern validation passed.");

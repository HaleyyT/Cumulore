import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = globSync("**/*.md", {
  cwd: root,
  exclude: ["node_modules/**", ".local/**"],
});
const broken = [];
for (const file of files) {
  const content = readFileSync(resolve(root, file), "utf8");
  for (const match of content.matchAll(
    /\[[^\]]+\]\(([^)\s]+)(?:\s+[^)]*)?\)/g,
  )) {
    const target = match[1];
    if (
      !target ||
      target.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/i.test(target)
    )
      continue;
    const path = target.split("#", 1)[0];
    if (path && !existsSync(resolve(root, dirname(file), path)))
      broken.push(`${file} -> ${target}`);
  }
}
if (broken.length > 0)
  throw new Error(`Broken local documentation links:\n${broken.join("\n")}`);
console.log(`Documentation link validation passed (${files.length} files).`);

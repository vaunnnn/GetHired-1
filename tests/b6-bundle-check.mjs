// Run after npm run build. Verify seed rubrics are absent from shipped JS.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
const source = await readFile("apps/api/content/interview-seed.ts", "utf8");
const rubrics = [...source.matchAll(/feedback:\s*("(?:[^"\\]|\\.)*")/g)].map(match => JSON.parse(match[1]));
assert.ok(rubrics.length >= 30, "Expected the complete seed rubric collection");
const files = (await readdir(".next/static", { recursive: true })).filter(path => path.endsWith(".js"));
assert.ok(files.length > 0, "Build the frontend first");
for (const file of files) {
  const content = await readFile(join(".next/static", file), "utf8");
  for (const rubric of rubrics) {
    const prefix = rubric.slice(0, 90);
    assert.ok(!content.includes(prefix) && !content.includes(JSON.stringify(prefix).slice(1, -1)), `Seed rubric leaked into ${file}`);
  }
}
console.log(`B6 bundle check passed: ${rubrics.length} seed rubrics absent from ${files.length} JavaScript assets.`);

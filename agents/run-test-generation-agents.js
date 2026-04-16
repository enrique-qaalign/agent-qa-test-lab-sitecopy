import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runNode(scriptPath, args = []) {
  const result = spawnSync("node", [scriptPath, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    console.error(`\nAgent failed: ${scriptPath}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status || 1);
  }

  if (result.stdout) process.stdout.write(result.stdout);
}

function main() {
  ensureDir(path.join(ROOT, "test-results", "test-generation"));
  ensureDir(path.join(ROOT, "test-results", "test-generation", "generated-specs"));
  ensureDir(path.join(ROOT, "test-results", "test-generation", "generated-page-objects"));

  const compositeInput =
    process.argv[2] ||
    "test-results/locator-intelligence/composite-action-candidates.json";

  const actionInput =
    process.argv[3] ||
    "test-results/locator-intelligence/action-method-candidates.json";

  const skeletonOutput =
    "test-results/test-generation/test-skeleton-candidates.json";
  const assertionOutput =
    "test-results/test-generation/assertion-candidates.json";
  const pageObjectOutput =
    "test-results/test-generation/page-object-draft.json";
  const specDraftOutput =
    "test-results/test-generation/spec-drafts.json";

  console.log(`Running Test Skeleton Generation with: ${compositeInput}`);
  runNode("agents/test-skeleton-generation/run.js", [
    compositeInput,
    skeletonOutput
  ]);

  console.log("Running Assertion Candidate Generation");
  runNode("agents/assertion-candidates/run.js", [
    skeletonOutput,
    assertionOutput
  ]);

  console.log(`Running Page Object Draft Generation with: ${actionInput}`);
  runNode("agents/page-object-draft-generation/run.js", [
    actionInput,
    compositeInput,
    pageObjectOutput
  ]);

  console.log("Running Spec Draft Generation");
  runNode("agents/spec-draft-generation/run.js", [
    skeletonOutput,
    assertionOutput,
    specDraftOutput
  ]);

  console.log("\nPipeline complete.");
  console.log(`Test skeletons: ${path.join(ROOT, skeletonOutput)}`);
  console.log(`Assertion candidates: ${path.join(ROOT, assertionOutput)}`);
  console.log(`Page object draft: ${path.join(ROOT, pageObjectOutput)}`);
  console.log(`Spec drafts: ${path.join(ROOT, specDraftOutput)}`);
  console.log(`Generated spec dir: ${path.join(ROOT, "test-results/test-generation/generated-specs")}`);
  console.log(`Generated page-object dir: ${path.join(ROOT, "test-results/test-generation/generated-page-objects")}`);
}

main();

import fs from "node:fs";
import path from "node:path";

const testInputPath = process.argv[2];
const assertionInputPath = process.argv[3];
const outputPath =
  process.argv[4] || "test-results/test-generation/spec-drafts.json";

if (!testInputPath || !assertionInputPath) {
  console.error("Usage: node agents/spec-draft-generation/run.js <test-skeleton-candidates.json> <assertion-candidates.json> [output.json]");
  process.exit(1);
}

const testsInput = JSON.parse(fs.readFileSync(testInputPath, "utf8"));
const assertionsInput = JSON.parse(fs.readFileSync(assertionInputPath, "utf8"));

const GENERATED_DIR = "test-results/test-generation/generated-specs";
fs.mkdirSync(GENERATED_DIR, { recursive: true });

const assertionMap = new Map(
  (assertionsInput.assertions || []).map((a) => [a.name, a])
);

const round2 = (n) => Math.round((n || 0) * 100) / 100;

function renderAssertions(names) {
  return (names || []).map((name) => {
    if (name === "authenticated_nav_visible") {
      return "  await expect(page.getByRole('navigation')).toBeVisible();";
    }
    if (name === "url_changes") {
      return "  await expect(page).not.toHaveURL(/login/i);";
    }
    if (name === "login_error_visible") {
      return "  await expect(page.getByRole('alert')).toBeVisible();";
    }
    if (name === "url_does_not_reach_authenticated_area") {
      return "  await expect(page).toHaveURL(/login/i);";
    }
    const hint = assertionMap.get(name)?.locatorHint || "review required";
    return `  // Candidate assertion: ${name} (${hint})`;
  }).join("\n");
}

const specs = (testsInput.tests || []).map((test, idx) => {
  const step = test.steps?.[0];
  const args = step?.args || {};
  const confidence = round2(test.confidence);

  const code = `import { test, expect } from '@playwright/test';
// TODO: replace with real import path
// import { LoginPage } from '../page-objects/LoginPage';

test('${test.testName}', async ({ page }) => {
  // Confidence: ${confidence}
  // Review required: ${test.reviewRequired ? "yes" : "no"}

  // TODO: replace with real page-object wiring
  // const loginPage = new LoginPage(page);

  // Candidate composite: ${step?.method || "unknown"}
  // await loginPage.${step?.method || "unknown"}('${args.username || ""}', '${args.password || ""}');

${renderAssertions(test.suggestedAssertions)}
});
`;

  const fileName = `generated-spec-${idx + 1}.spec.ts`;
  const filePath = path.join(GENERATED_DIR, fileName);
  fs.writeFileSync(filePath, code, "utf8");

  return {
    fileName,
    filePath,
    testName: test.testName,
    code,
    confidence
  };
});

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  framework: "playwright",
  outputDir: GENERATED_DIR,
  specs
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${specs.length} spec file(s) to ${GENERATED_DIR}`);

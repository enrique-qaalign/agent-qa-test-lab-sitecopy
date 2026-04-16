import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || "test-results/test-generation/test-skeleton-candidates.json";

if (!inputPath) {
  console.error("Usage: node agents/test-skeleton-generation/run.js <composite-action-candidates.json> [output.json]");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const composites = input.composites || [];

const tests = [];

for (const composite of composites) {
  if (composite.methodName === "loginAs") {
    tests.push({
      testName: "registered user can sign in",
      kind: "positive_auth",
      uses: ["loginAs"],
      steps: [
        { method: "loginAs", args: { username: "user@example.com", password: "Password123!" } }
      ],
      confidence: composite.confidence,
      reviewRequired: composite.confidence < 0.9,
      suggestedAssertions: [
        "authenticated_nav_visible",
        "url_changes"
      ]
    });

    tests.push({
      testName: "invalid password is rejected",
      kind: "negative_auth",
      uses: ["loginAs"],
      steps: [
        { method: "loginAs", args: { username: "user@example.com", password: "WrongPassword!" } }
      ],
      confidence: composite.confidence - 0.05,
      reviewRequired: true,
      suggestedAssertions: [
        "login_error_visible",
        "url_does_not_reach_authenticated_area"
      ]
    });
  }
}

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  pageObject: input.pageObject || "GeneratedPage",
  tests
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);

import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || "test-results/test-generation/assertion-candidates.json";

if (!inputPath) {
  console.error("Usage: node agents/assertion-candidates/run.js <test-skeleton-candidates.json> [output.json]");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const tests = input.tests || [];

const seen = new Map();

for (const test of tests) {
  for (const name of test.suggestedAssertions || []) {
    if (!seen.has(name)) {
      let locatorHint = "";
      if (name === "authenticated_nav_visible") locatorHint = "user menu, sign out button, or profile nav";
      if (name === "login_error_visible") locatorHint = "error alert, validation message, or inline auth error";
      if (name === "url_changes") locatorHint = "expect(page).toHaveURL(...)";
      if (name === "url_does_not_reach_authenticated_area") locatorHint = "expect(page).not.toHaveURL(...)";

      seen.set(name, {
        name,
        kind: name.includes("url") ? "navigation" : "visibility",
        locatorHint,
        confidence: 0.82
      });
    }
  }
}

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  assertions: [...seen.values()]
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);

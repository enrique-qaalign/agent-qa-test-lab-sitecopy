import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || "test-results/locator-intelligence/composite-action-candidates.json";

if (!inputPath) {
  console.error("Usage: node agents/composite-action-synthesis/run.js <action-method-candidates.json> [output.json]");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const methods = input.methods || [];

function find(name) {
  return methods.find((m) => m.methodName === name);
}

const composites = [];

const fillUsername = find("fillUsername");
const fillPassword = find("fillPassword");
const submitLogin = find("submitLogin");

if (fillUsername && fillPassword && submitLogin) {
  const confidence = Math.min(
    fillUsername.confidence || 0,
    fillPassword.confidence || 0,
    submitLogin.confidence || 0
  );

  if (confidence >= 0.9) {
    composites.push({
      methodName: "loginAs",
      kind: "composite",
      component: "login_form",
      args: [
        { name: "username", type: "string" },
        { name: "password", type: "string" }
      ],
      steps: [
        { method: "fillUsername", argMap: { value: "username" } },
        { method: "fillPassword", argMap: { value: "password" } },
        { method: "submitLogin", argMap: {} }
      ],
      postConditions: ["url_changes", "authenticated_nav_visible"],
      confidence
    });
  }
}

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  pageObject: input.pageObject || "GeneratedPage",
  composites
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);

import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || "test-results/locator-intelligence/action-method-candidates.json";

if (!inputPath) {
  console.error("Usage: node agents/action-method-synthesis/run.js <element-type-map.json> [output.json]");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const elements = input.elements || [];

function toPascal(s) {
  return s
    .replace(/[_\-.]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(x => x.charAt(0).toUpperCase() + x.slice(1))
    .join("");
}

function methodForIntent(intent, role) {
  if (intent === "auth.username") return ["fillUsername", "fill", [{ name: "value", type: "string" }]];
  if (intent === "auth.password") return ["fillPassword", "fill", [{ name: "value", type: "string" }]];
  if (intent === "auth.submit") return ["submitLogin", "click", []];
  if (intent === "search.query") return ["fillSearchQuery", "fill", [{ name: "value", type: "string" }]];
  if (intent === "entity.save") return ["clickSave", "click", []];
  if (intent === "entity.publish") return ["clickPublish", "click", []];
  if (intent === "entity.delete") return ["clickDelete", "click", []];

  if ((role || "").includes("textbox")) return ["fillField", "fill", [{ name: "value", type: "string" }]];
  if ((role || "").includes("button")) return ["clickAction", "click", []];
  if ((role || "").includes("link")) return ["openLink", "click", []];

  return ["interact", "unknown", []];
}

const methods = elements.map((el) => {
  const [baseName, action, args] = methodForIntent(el.intent, el.role);
  const safeName =
    baseName === "fillField" || baseName === "clickAction" || baseName === "openLink"
      ? `${baseName}${toPascal(el.elementId.split(".").pop() || "Element")}`
      : baseName;

  return {
    methodName: safeName,
    intent: el.intent,
    elementId: el.elementId,
    kind: "primitive",
    action,
    args,
    returns: "Promise<void>",
    confidence: el.confidence
  };
});

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  pageObject: input.page?.title
    ? `${toPascal(input.page.title.replace(/[^a-zA-Z0-9 ]/g, ""))}Page`
    : "GeneratedPage",
  methods
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);

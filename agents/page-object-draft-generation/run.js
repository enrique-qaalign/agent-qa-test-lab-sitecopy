import fs from "node:fs";
import path from "node:path";

const actionInputPath = process.argv[2];
const compositeInputPath = process.argv[3];
const outputPath =
  process.argv[4] || "test-results/test-generation/page-object-draft.json";
const elementTypeInputPath = process.argv[5];

if (!actionInputPath || !compositeInputPath) {
  console.error("Usage: node agents/page-object-draft-generation/run.js <action-method-candidates.json> <composite-action-candidates.json> [output.json]");
  process.exit(1);
}

const actionInput = JSON.parse(fs.readFileSync(actionInputPath, "utf8"));
const compositeInput = JSON.parse(fs.readFileSync(compositeInputPath, "utf8"));
const elementTypeInput = elementTypeInputPath && fs.existsSync(elementTypeInputPath)
  ? JSON.parse(fs.readFileSync(elementTypeInputPath, "utf8"))
  : { elements: [] };

const elementById = new Map(
  (elementTypeInput.elements || []).map((el) => [el.elementId, el])
);

const GENERATED_DIR = "test-results/test-generation/generated-page-objects";
fs.mkdirSync(GENERATED_DIR, { recursive: true });

const pageObject = actionInput.pageObject || "GeneratedPage";
const fileName = `${pageObject}.ts`;
const filePath = path.join(GENERATED_DIR, fileName);

function locatorExpr(method) {
  const el = elementById.get(method.elementId);

  if (el && el.locator) return el.locator;

  if (method.intent === "auth.username") return "page.getByLabel('Email')";
  if (method.intent === "auth.password") return "page.getByLabel('Password')";
  if (method.intent === "auth.submit") return "page.getByRole('button', { name: 'Sign in' })";

  return "page.locator('TODO')";
}

const primitiveFields = (actionInput.methods || []).map((m) => {
  const fieldName = `${m.methodName}Target`;
  return `    this.${fieldName} = ${locatorExpr(m)};`;
}).join("\n");

const primitiveProps = (actionInput.methods || []).map((m) => {
  const fieldName = `${m.methodName}Target`;
  return `  ${fieldName};`;
}).join("\n");

const primitiveMethods = (actionInput.methods || []).map((m) => {
  const fieldName = `${m.methodName}Target`;
  if (m.action === "fill") {
    return `  async ${m.methodName}(value) {
    await this.${fieldName}.fill(value);
  }`;
  }
  if (m.action === "click") {
    return `  async ${m.methodName}() {
    await this.${fieldName}.click();
  }`;
  }
  return `  async ${m.methodName}() {
    // TODO: unsupported action type: ${m.action}
  }`;
}).join("\n\n");

const compositeMethods = (compositeInput.composites || []).map((c) => {
  const args = (c.args || []).map((a) => a.name).join(", ");
  const steps = (c.steps || []).map((s) => {
    const mappedArgs = Object.values(s.argMap || {});
    if (!mappedArgs.length) return `    await this.${s.method}();`;
    return `    await this.${s.method}(${mappedArgs.join(", ")});`;
  }).join("\n");

  return `  async ${c.methodName}(${args}) {
${steps}
  }`;
}).join("\n\n");

const code = `export class ${pageObject} {
  constructor(page) {
    this.page = page;
${primitiveFields}
  }

  page;
${primitiveProps}

${primitiveMethods}

${compositeMethods}
}
`;

fs.writeFileSync(filePath, code, "utf8");

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  pageObject,
  fileName,
  filePath,
  code
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Wrote page object draft to ${filePath}`);

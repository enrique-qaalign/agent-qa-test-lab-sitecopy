import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

/**
 * Usage:
 * node agents/build-assessment-input-from-workbook.js /path/to/workbook.xlsx playwright out/workbook-assessment-input.json
 *
 * Optional 4th arg = output path. Defaults to out/workbook-assessment-input.json
 */

const workbookPath = process.argv[2];
const frameworkArg = process.argv[3];
const outputPath = process.argv[4] || "out/workbook-assessment-input.json";

if (!workbookPath || !frameworkArg) {
  console.error("Usage: node agents/build-assessment-input-from-workbook.js <workbook.xlsx> <framework> [output.json]");
  process.exit(1);
}

const frameworkMap = {
  playwright: "Playwright",
  pytest: "pytest",
  cypress: "Cypress",
  selenium: "Selenium"
};

const categoryToFamily = {
  "Selectors & Locators": "LOCATOR",
  "Waiting & Flakiness": "TIMING",
  "Test Isolation & State": "STATE",
  "Parallelism & Concurrency": "STATE",
  "Fixtures & Setup/Teardown": "STATE",
  "Reporting & Debuggability": "DIAGNOSABILITY",
  "CI/CD & Environment Drift": "ENV",
  "Network & API Mocking": "MOCK_REALISM",
  "Assertions & Oracles": "ASSERTION",
  "Code Structure & Maintainability": "STRUCTURE",
  "Performance & Timeouts": "TIMING"
};

const severityMap = {
  "Low": "low",
  "Medium": "medium",
  "High": "high"
};

const impactMap = {
  "Blocks trust": "blocks_trust",
  "False green risk": "causes_false_green_risk",
  "Slows diagnosis": "slows_diagnosis",
  "Weakens release confidence": "weakens_release_confidence",
  "Scalability risk only": "scalability_risk_only"
};

const pathMap = {
  "No AI": "no_ai",
  "Some AI": "some_ai",
  "AI Forward": "ai_forward"
};

const layerMap = {
  "UI": "ui",
  "API": "api",
  "CI": "ci",
  "Data": "data",
  "Release": "release",
  "Auth": "auth"
};

const wantedFramework = frameworkMap[frameworkArg.toLowerCase()];
if (!wantedFramework) {
  console.error(`Unsupported framework: ${frameworkArg}`);
  process.exit(1);
}

const wb = xlsx.readFile(workbookPath);
const ws = wb.Sheets["Matrix"];
if (!ws) {
  console.error("Workbook missing 'Matrix' sheet");
  process.exit(1);
}

const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

const antiPatterns = rows
  .filter((row) => row["Framework"] === wantedFramework)
  .map((row) => ({
    title: row["Anti-pattern"],
    family: categoryToFamily[row["Category"]] || "STRUCTURE",
    severity: severityMap[row["Severity"]] || "medium",
    scope: (row["Scope"] || "Recurring").toLowerCase().replace(" ", "_"),
    layer: layerMap[row["Layer"]] || "ui",
    releaseImpact: impactMap[row["Release Impact"]] || "weakens_release_confidence",
    notes: row["Notes"] || row["Root Cause"] || row["Symptom / Failure Mode"] || "",
    category: row["Category"],
    preferredPattern: row["Preferred Pattern"] || "",
    fixSteps: row["Fix / Refactor Steps"] || "",
    ciGuardrail: row["CI Guardrail / Policy"] || "",
    firstSprint: String(row["First Sprint"] || "")
  }));

const out = {
  framework: frameworkArg.toLowerCase(),
  antiPatterns
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);

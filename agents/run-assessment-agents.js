import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function runNode(scriptPath, inputPath, outputPath) {
  const result = spawnSync("node", [scriptPath, inputPath], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    console.error(`\nAgent failed: ${scriptPath}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status || 1);
  }

  fs.writeFileSync(outputPath, result.stdout, "utf8");
  return readJson(outputPath);
}

function main() {
  ensureDir(OUT_DIR);

  const assessmentInput =
    process.argv[2] || "agents/framework-assessment/sample-input.json";

  const assessmentScript = "agents/framework-assessment/run.js";
  const routerScript = "agents/sprint-router/run.js";
  const reportScript = "agents/advisory-report/run.js";

  const assessmentOutputPath = path.join(OUT_DIR, "framework-assessment.json");
  const routerInputPath = path.join(OUT_DIR, "framework-assessment-wrapper.json");
  const routerOutputPath = path.join(OUT_DIR, "sprint-routing.json");
  const reportInputPath = path.join(OUT_DIR, "report-input.json");
  const reportOutputPath = path.join(OUT_DIR, "advisory-report.json");

  console.log(`Running Framework Assessment Agent with: ${assessmentInput}`);
  const frameworkAssessment = runNode(
    assessmentScript,
    assessmentInput,
    assessmentOutputPath
  );

  const routerInput = { frameworkAssessment };
  writeJson(routerInputPath, routerInput);

  console.log("Running Sprint Routing Agent");
  const sprintRouting = runNode(routerScript, routerInputPath, routerOutputPath);

  const reportInput = {
    frameworkAssessment,
    sprintRouting,
  };
  writeJson(reportInputPath, reportInput);

  console.log("Running Advisory Report Agent");
  const advisoryReport = runNode(reportScript, reportInputPath, reportOutputPath);

  console.log("\nPipeline complete.");
  console.log(`Assessment: ${assessmentOutputPath}`);
  console.log(`Router input: ${routerInputPath}`);
  console.log(`Routing: ${routerOutputPath}`);
  console.log(`Report input: ${reportInputPath}`);
  console.log(`Report: ${reportOutputPath}`);

  console.log("\nExecutive Summary:");
  console.log(
    `- Framework: ${advisoryReport.executiveSummary.framework}`
  );
  console.log(
    `- Trust Level: ${advisoryReport.executiveSummary.trustLevel}`
  );
  console.log(
    `- Path: ${advisoryReport.executiveSummary.pathRecommendation}`
  );
  console.log(
    `- Start Sprint: ${advisoryReport.executiveSummary.recommendedStartSprint}`
  );
}

main();

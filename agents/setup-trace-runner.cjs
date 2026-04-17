#!/usr/bin/env node

/**
 * Setup Trace Runner — V1
 *
 * Purpose:
 * - Read setup-trace-report.json
 * - Select representative occurrence(s)
 * - Build temporary instrumented Playwright spec(s)
 * - Execute them with scoped network capture
 * - Emit runtime-capture.json + runtime-capture.md
 *
 * This version assumes the target repo is Playwright-based and runnable.
 * It does NOT yet patch original tests in-place.
 */

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

function parseArgs(argv) {
  const args = {
    traceReport: "test-results/setup-trace/setup-trace-report.json",
    repo: ".",
    outDir: "test-results/setup-trace/runtime",
    playwrightCmd: "npx playwright test",
    maxOccurrences: 1,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--traceReport" && argv[i + 1]) {
      args.traceReport = argv[++i];
    } else if (arg === "--repo" && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (arg === "--outDir" && argv[i + 1]) {
      args.outDir = argv[++i];
    } else if (arg === "--playwrightCmd" && argv[i + 1]) {
      args.playwrightCmd = argv[++i];
    } else if (arg === "--maxOccurrences" && argv[i + 1]) {
      args.maxOccurrences = Number(argv[++i]);
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    } else {
      console.warn(`[setup-trace-runner] Ignoring unknown arg: ${arg}`);
    }
  }

  if (!Number.isInteger(args.maxOccurrences) || args.maxOccurrences < 1) {
    throw new Error("--maxOccurrences must be an integer >= 1");
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`
Setup Trace Runner — V1

Usage:
  node agents/setup-trace-runner.cjs \\
    --traceReport test-results/setup-trace/setup-trace-report.json \\
    --repo /path/to/playwright-framework \\
    --outDir test-results/setup-trace/runtime \\
    --playwrightCmd "npx playwright test"

Options:
  --traceReport <path>      Path to setup-trace-report.json
  --repo <path>             Repository root to execute against
  --outDir <path>           Output directory
  --playwrightCmd <cmd>     Playwright command (default: npx playwright test)
  --maxOccurrences <n>      Number of representative occurrences to run (default: 1)
  --verbose                 Print extra debug information
  --help, -h                Show this help
`);
  process.exit(code);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function getLines(text) {
  return text.split("\n");
}

function indentLines(lines, spaces) {
  const pad = " ".repeat(spaces);
  return lines.map((line) => `${pad}${line}`).join("\n");
}

function shellEscapeSingleQuotes(str) {
  return str.replace(/'/g, `'\\''`);
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function relativeFromRepo(repoRoot, absPath) {
  return toPosix(path.relative(repoRoot, absPath));
}

function buildInstrumentedSpec({ occurrence, repoRoot, runtimeHelperAbsPath, outCapturePath }) {
  const targetFileAbs = path.resolve(repoRoot, occurrence.file);
  const originalText = readText(targetFileAbs);
  const lines = getLines(originalText);

  const snippetLines = lines.slice(occurrence.lineStart - 1, occurrence.lineEnd);
  const snippet = snippetLines.join("\n");

  const title = occurrence.testTitle;
  const helperImport = "./trace-runtime-helper.cjs";

  return `const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { createScopedNetworkTracer } = require(${JSON.stringify(helperImport)});

test("trace runner :: ${title.replace(/"/g, '\\"')}", async ({ page, request }) => {
  const tracer = createScopedNetworkTracer(page);

  tracer.reset();
  tracer.start();

${indentLines(snippetLines, 2)}

  tracer.stop();

  const payload = {
    sourceFile: ${JSON.stringify(occurrence.file)},
    testTitle: ${JSON.stringify(occurrence.testTitle)},
    lineStart: ${occurrence.lineStart},
    lineEnd: ${occurrence.lineEnd},
    capturedEvents: tracer.getEvents(),
    summary: tracer.getSummary(),
  };

  fs.mkdirSync(path.dirname(${JSON.stringify(outCapturePath)}), { recursive: true });
  fs.writeFileSync(${JSON.stringify(outCapturePath)}, JSON.stringify(payload, null, 2), "utf8");
});
`;
}

function executeCommand(command, cwd, verbose) {
  if (verbose) {
    console.log(`[setup-trace-runner] Exec: ${command}`);
    console.log(`[setup-trace-runner] CWD:  ${cwd}`);
  }

  return cp.execSync(command, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
    },
  });
}

function renderMarkdown(report) {
  const lines = [];

  lines.push("# Setup Trace Runtime Capture");
  lines.push("");
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push(`- Pattern ID: ${report.patternId}`);
  lines.push(`- Executed Occurrences: ${report.executedOccurrences.length}`);
  lines.push("");

  for (const occ of report.executedOccurrences) {
    lines.push(`## ${occ.testTitle}`);
    lines.push("");
    lines.push(`- File: \`${occ.file}\``);
    lines.push(`- Lines: ${occ.lineStart}-${occ.lineEnd}`);
    lines.push(`- Temp Spec: \`${occ.tempSpec}\``);
    lines.push(`- Runtime Capture: \`${occ.runtimeCaptureFile}\``);
    lines.push(`- Command: \`${occ.command}\``);
    lines.push(`- Exit Status: ${occ.exitStatus}`);
    lines.push(`- Request Count: ${occ.summary?.requestCount ?? 0}`);
    lines.push(`- Response Count: ${occ.summary?.responseCount ?? 0}`);
    lines.push("");

    if (occ.summary?.uniqueUrls?.length) {
      lines.push("### Unique URLs");
      lines.push("");
      for (const url of occ.summary.uniqueUrls) {
        lines.push(`- ${url}`);
      }
      lines.push("");
    }

    if (occ.stderr) {
      lines.push("### STDERR");
      lines.push("");
      lines.push("```text");
      lines.push(occ.stderr);
      lines.push("```");
      lines.push("");
    }

    if (occ.stdout) {
      lines.push("### STDOUT");
      lines.push("");
      lines.push("```text");
      lines.push(occ.stdout);
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.repo);
  const traceReportPath = path.resolve(args.traceReport);
  const outDir = path.resolve(args.outDir);
  const repoRuntimeDir = path.join(repoRoot, "test-results", "setup-trace-runtime");
  ensureDir(repoTempSpecDir);
  console.log("[setup-trace-runner] BUILD MARKER: runtime-capture-v1");

  if (!fs.existsSync(repoRoot)) {
    throw new Error(`Repo path does not exist: ${repoRoot}`);
  }

  if (!fs.existsSync(traceReportPath)) {
    throw new Error(`Trace report not found: ${traceReportPath}`);
  }

  const traceReport = readJson(traceReportPath);
  const reps = (traceReport.representativeOccurrences || []).slice(0, args.maxOccurrences);

  if (!reps.length) {
    throw new Error("No representativeOccurrences found in setup-trace-report.json");
  }


  const runtimeHelperSrc = path.resolve(path.dirname(traceReportPath), "trace-runtime-helper.cjs");
  const runtimeHelperDst = path.join(repoTempSpecDir, "trace-runtime-helper.cjs");
  ensureDir(repoRuntimeDir);

  if (!fs.existsSync(runtimeHelperSrc)) {
    throw new Error(`trace-runtime-helper.cjs not found next to trace report: ${runtimeHelperSrc}`);
  }

  fs.copyFileSync(runtimeHelperSrc, helperPath);
  if (!fs.existsSync(runtimeHelperDst)) {
    throw new Error(`Failed to copy trace runtime helper to target repo: ${runtimeHelperDst}`);
  }

  console.log(`[setup-trace-runner] Helper copied to ${runtimeHelperDst}`);
    const executedOccurrences = [];

reps.forEach((occ, index) => {
  const sourceFileAbs = path.resolve(repoRoot, occ.file);
  const sourceDir = path.dirname(sourceFileAbs);

  const tempSpecName = `temp-trace-${index + 1}.spec.js`;
  const tempSpecPath = path.join(sourceDir, tempSpecName);
  const helperPath = path.join(sourceDir, "trace-runtime-helper.cjs");
  const runtimeCaptureFile = path.join(
    repoRuntimeDir,
    `runtime-capture-${index + 1}.json`
  );

  fs.copyFileSync(runtimeHelperSrc, helperPath);

  const specText = buildInstrumentedSpec({
    occurrence: occ,
    repoRoot,
    runtimeHelperAbsPath: "./trace-runtime-helper.cjs",
    outCapturePath: runtimeCaptureFile,
  });

  writeText(tempSpecPath, specText);

  const relativeTempSpec = relativeFromRepo(repoRoot, tempSpecPath);
  const command = `${args.playwrightCmd} ${relativeTempSpec}`;

  let stdout = "";
  let stderr = "";
  let exitStatus = 0;
  let capture = null;

  try {
    stdout = executeCommand(command, repoRoot, args.verbose) || "";
  } catch (error) {
    stdout = error.stdout || "";
    stderr = error.stderr || error.message || "";
    exitStatus = typeof error.status === "number" ? error.status : 1;
  }

  if (fs.existsSync(runtimeCaptureFile)) {
    capture = readJson(runtimeCaptureFile);
  }

  executedOccurrences.push({
    file: occ.file,
    testTitle: occ.testTitle,
    lineStart: occ.lineStart,
    lineEnd: occ.lineEnd,
    tempSpec: tempSpecPath,
    runtimeCaptureFile,
    command,
    exitStatus,
    stdout,
    stderr,
    summary: capture?.summary || null,
    capturedEventsCount: Array.isArray(capture?.capturedEvents)
      ? capture.capturedEvents.length
      : 0,
  });
});

  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    patternId: traceReport.patternId,
    candidateFixture: traceReport.candidateFixture,
    executedOccurrences,
  };

  const reportJsonPath = path.join(outDir, "runtime-capture-report.json");
  const reportMdPath = path.join(outDir, "runtime-capture-report.md");

  writeText(reportJsonPath, JSON.stringify(report, null, 2));
  writeText(reportMdPath, renderMarkdown(report));

  console.log(`[setup-trace-runner] Wrote ${reportJsonPath}`);
  console.log(`[setup-trace-runner] Wrote ${reportMdPath}`);
  console.log("");
  console.log(
    `[setup-trace-runner] Executed ${executedOccurrences.length} representative occurrence(s)`
  );
}

try {
  main();
} catch (error) {
  console.error("[setup-trace-runner] Fatal error:", error.message);
  process.exit(1);
}

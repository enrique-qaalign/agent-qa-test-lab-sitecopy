#!/usr/bin/env node

/**
 * Setup Trace Agent — V1.5
 *
 * Purpose:
 * - Read fixture-extraction-report.json
 * - Select one repeated setup pattern
 * - Produce a trace plan for representative occurrences
 * - Generate a runtime helper for scoped request/response capture
 *
 * This version does NOT:
 * - auto-run Playwright
 * - auto-patch test files
 * - auto-rewrite fixtures
 *
 * Outputs:
 * - <outDir>/setup-trace-report.json
 * - <outDir>/setup-trace-report.md
 * - <outDir>/trace-runtime-helper.cjs
 *
 * Example:
 *   node agents/setup-trace-agent.cjs \
 *     --patternId setup.authenticated_seeded_user.fbb7ba \
 *     --fixtureReport test-results/fixture-extraction/fixture-extraction-report.json \
 *     --repo /Users/enriquehenderson/playwright-automation-framework \
 *     --outDir test-results/setup-trace
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    patternId: "",
    fixtureReport: "test-results/fixture-extraction/fixture-extraction-report.json",
    repo: ".",
    outDir: "test-results/setup-trace",
    maxOccurrences: 3,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--patternId" && argv[i + 1]) {
      args.patternId = argv[++i];
    } else if (arg === "--fixtureReport" && argv[i + 1]) {
      args.fixtureReport = argv[++i];
    } else if (arg === "--repo" && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (arg === "--outDir" && argv[i + 1]) {
      args.outDir = argv[++i];
    } else if (arg === "--maxOccurrences" && argv[i + 1]) {
      args.maxOccurrences = Number(argv[++i]);
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    } else {
      console.warn(`[setup-trace-agent] Ignoring unknown arg: ${arg}`);
    }
  }

  if (!args.patternId) {
    throw new Error("--patternId is required");
  }

  if (!Number.isInteger(args.maxOccurrences) || args.maxOccurrences < 1) {
    throw new Error("--maxOccurrences must be an integer >= 1");
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`
Setup Trace Agent — V1.5

Usage:
  node agents/setup-trace-agent.cjs \\
    --patternId <pattern-id> \\
    --fixtureReport test-results/fixture-extraction/fixture-extraction-report.json \\
    --repo . \\
    --outDir test-results/setup-trace

Options:
  --patternId <id>          Pattern ID from fixture extraction report
  --fixtureReport <path>    Path to fixture-extraction-report.json
  --repo <path>             Repository root being analyzed
  --outDir <path>           Output directory
  --maxOccurrences <n>      Max representative occurrences to include (default: 3)
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

function getLines(text) {
  return text.split("\n");
}

function safeSliceLines(lines, startLine, endLine) {
  const startIdx = Math.max(0, startLine - 1);
  const endIdx = Math.min(lines.length, endLine);
  return lines.slice(startIdx, endIdx);
}

function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).slice(0, 8);
}

function scoreRequestCandidateFromSetupLines(originalLines) {
  const joined = originalLines.join(" ").toLowerCase();

  let score = 0.2;
  const reasons = [];

  if (joined.includes("request.post(")) {
    score += 0.35;
    reasons.push("contains request.post");
  }

  if (joined.includes("/api/")) {
    score += 0.20;
    reasons.push("contains explicit /api/ route");
  }

  if (
    joined.includes("/api/users") ||
    joined.includes("/api/articles") ||
    joined.includes("/api/projects") ||
    joined.includes("/api/accounts")
  ) {
    score += 0.15;
    reasons.push("contains domain entity route");
  }

  if (joined.includes("sign in") || joined.includes("/login")) {
    score += 0.05;
    reasons.push("contains auth-related UI setup");
  }

  if (joined.includes("publish article") || joined.includes("new article")) {
    score += 0.05;
    reasons.push("contains article creation UI flow");
  }

  return {
    confidence: Math.min(0.95, Number(score.toFixed(2))),
    reasons,
  };
}

function inferEntityType(patternId, fixtureName, occurrences) {
  const joined = [
    patternId,
    fixtureName,
    ...occurrences.flatMap((o) => o.originalLines || []),
  ]
    .join(" ")
    .toLowerCase();

  if (joined.includes("article")) return "article";
  if (joined.includes("project")) return "project";
  if (joined.includes("account")) return "account";
  if (joined.includes("billing")) return "billing";
  if (joined.includes("user")) return "user";
  if (joined.includes("login") || joined.includes("signin")) return "auth";
  return "unknown";
}

function buildTracePlan(candidate, repoRoot, maxOccurrences) {
  const reps = candidate.occurrences.slice(0, maxOccurrences).map((occ) => {
    const filePath = path.resolve(repoRoot, occ.file);
    const fileText = readText(filePath);
    const lines = getLines(fileText);
    const sourceLines = safeSliceLines(lines, occ.lineStart, occ.lineEnd);

    const requestScore = scoreRequestCandidateFromSetupLines(occ.originalLines || []);

    return {
      file: occ.file,
      absoluteFile: filePath,
      testTitle: occ.testTitle,
      lineStart: occ.lineStart,
      lineEnd: occ.lineEnd,
      sourceSnippet: sourceLines,
      setupLikelihoodScore: occ.setupLikelihoodScore,
      setupLikelihoodSignals: occ.setupLikelihoodSignals,
      originalLines: occ.originalLines,
      traceWindow: {
        startLine: occ.lineStart,
        endLine: occ.lineEnd,
      },
      requestCandidateScore: requestScore.confidence,
      requestCandidateReasons: requestScore.reasons,
    };
  });

  const entityType = inferEntityType(
    candidate.patternId,
    candidate.candidateFixture,
    candidate.occurrences
  );

  return {
    patternId: candidate.patternId,
    candidateFixture: candidate.candidateFixture,
    entityType,
    representativeOccurrences: reps,
    traceStrategy: {
      mode: "manual-assisted",
      captureWindow: "line-range",
      recommendation:
        "Wrap request/response capture immediately before the repeated setup block and stop it immediately after the block completes.",
    },
    expectedEvidence: [
      "request method",
      "request url",
      "request postData when available",
      "response status",
      "parsed response json when available",
      "ordered request sequence during setup window",
    ],
  };
}

function buildRuntimeHelper() {
  return `#!/usr/bin/env node

/**
 * trace-runtime-helper.cjs
 *
 * Helper module for scoped Playwright request/response capture.
 * Import this from a temporary instrumented spec or from a custom harness.
 */

function createScopedNetworkTracer(page) {
  let active = false;
  const events = [];

  function nowIso() {
    return new Date().toISOString();
  }

  page.on("request", (request) => {
    if (!active) return;

    events.push({
      ts: nowIso(),
      type: "request",
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      postData: safePostData(request),
      headers: request.headers(),
    });
  });

  page.on("response", async (response) => {
    if (!active) return;

    let body = null;
    try {
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("application/json")) {
        body = await response.json();
      } else if (contentType.includes("text/")) {
        body = await response.text();
      }
    } catch (error) {
      body = { _readError: error.message };
    }

    events.push({
      ts: nowIso(),
      type: "response",
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      body,
    });
  });

  return {
    start() {
      active = true;
    },

    stop() {
      active = false;
    },

    getEvents() {
      return [...events];
    },

    reset() {
      events.length = 0;
    },

    getSummary() {
      return summarizeEvents(events);
    },
  };
}

function safePostData(request) {
  try {
    return request.postData() || null;
  } catch (error) {
    return null;
  }
}

function summarizeEvents(events) {
  const requests = events.filter((e) => e.type === "request");
  const responses = events.filter((e) => e.type === "response");

  const uniqueUrls = [...new Set(requests.map((r) => r.url))];

  return {
    requestCount: requests.length,
    responseCount: responses.length,
    uniqueUrls,
    requestMethods: requests.map((r) => r.method),
  };
}

module.exports = {
  createScopedNetworkTracer,
};
`;
}

function buildCandidateRequestSummary(tracePlan) {
  const summaries = [];

  for (const occ of tracePlan.representativeOccurrences) {
    const joined = (occ.originalLines || []).join(" ");
    const lower = joined.toLowerCase();

    const likelyRequests = [];

    const directRouteMatches = lower.match(/\/api\/[a-z0-9_/-]+/g) || [];
    for (const route of [...new Set(directRouteMatches)]) {
      likelyRequests.push({
        method: lower.includes("request.post(") ? "POST" : "UNKNOWN",
        route,
        confidence: occ.requestCandidateScore,
        reasons: occ.requestCandidateReasons,
      });
    }

    summaries.push({
      file: occ.file,
      testTitle: occ.testTitle,
      likelyRequests,
    });
  }

  return summaries;
}

function renderMarkdown(report) {
  const lines = [];

  lines.push("# Setup Trace Report");
  lines.push("");
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push(`- Pattern ID: ${report.patternId}`);
  lines.push(`- Candidate Fixture: ${report.candidateFixture}`);
  lines.push(`- Entity Type: ${report.entityType}`);
  lines.push(`- Representative Occurrences: ${report.representativeOccurrences.length}`);
  lines.push("");

  lines.push("## Trace Strategy");
  lines.push("");
  lines.push(`- Mode: ${report.traceStrategy.mode}`);
  lines.push(`- Capture Window: ${report.traceStrategy.captureWindow}`);
  lines.push(`- Recommendation: ${report.traceStrategy.recommendation}`);
  lines.push("");

  lines.push("## Representative Occurrences");
  lines.push("");

  for (const occ of report.representativeOccurrences) {
    lines.push(`### ${occ.testTitle}`);
    lines.push("");
    lines.push(`- File: ${occ.file}`);
    lines.push(`- Lines: ${occ.lineStart}-${occ.lineEnd}`);
    lines.push(`- Request Candidate Score: ${occ.requestCandidateScore}`);
    lines.push(`- Reasons: ${occ.requestCandidateReasons.join(", ") || "none"}`);
    lines.push("");

    lines.push("```js");
    for (const line of occ.sourceSnippet) {
      lines.push(line);
    }
    lines.push("```");
    lines.push("");
  }

  lines.push("## Likely Request Targets");
  lines.push("");

  for (const req of report.candidateRequests) {
    lines.push(`### ${req.testTitle}`);
    lines.push("");
    lines.push(`- File: ${req.file}`);

    if (!req.likelyRequests.length) {
      lines.push(`- No direct /api/ route inferred from setup block`);
      lines.push("");
      continue;
    }

    for (const item of req.likelyRequests) {
      lines.push(
        `- ${item.method} ${item.route} (confidence ${item.confidence})`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.repo);
  const outDir = path.resolve(args.outDir);
  const fixtureReportPath = path.resolve(args.fixtureReport);

  console.log("[setup-trace-agent] BUILD MARKER: trace-plan-v1");

  if (!fs.existsSync(repoRoot)) {
    throw new Error(`Repo path does not exist: ${repoRoot}`);
  }

  if (!fs.existsSync(fixtureReportPath)) {
    throw new Error(`Fixture report not found: ${fixtureReportPath}`);
  }

  const fixtureReport = readJson(fixtureReportPath);
  const candidate = (fixtureReport.candidates || []).find(
    (c) => c.patternId === args.patternId
  );

  if (!candidate) {
    throw new Error(`Pattern ID not found in fixture report: ${args.patternId}`);
  }

  const tracePlan = buildTracePlan(candidate, repoRoot, args.maxOccurrences);
  const candidateRequests = buildCandidateRequestSummary(tracePlan);

  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    patternId: tracePlan.patternId,
    candidateFixture: tracePlan.candidateFixture,
    entityType: tracePlan.entityType,
    traceStrategy: tracePlan.traceStrategy,
    expectedEvidence: tracePlan.expectedEvidence,
    representativeOccurrences: tracePlan.representativeOccurrences,
    candidateRequests,
  };

  ensureDir(outDir);

  const jsonPath = path.join(outDir, "setup-trace-report.json");
  const mdPath = path.join(outDir, "setup-trace-report.md");
  const helperPath = path.join(outDir, "trace-runtime-helper.cjs");

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf8");
  fs.writeFileSync(helperPath, buildRuntimeHelper(), "utf8");

  console.log(`[setup-trace-agent] Wrote ${jsonPath}`);
  console.log(`[setup-trace-agent] Wrote ${mdPath}`);
  console.log(`[setup-trace-agent] Wrote ${helperPath}`);
  console.log("");
  console.log(
    `[setup-trace-agent] Planned ${report.representativeOccurrences.length} representative trace occurrence(s)`
  );
}

try {
  main();
} catch (error) {
  console.error("[setup-trace-agent] Fatal error:", error.message);
  process.exit(1);
}

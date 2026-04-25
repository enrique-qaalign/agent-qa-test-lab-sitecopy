#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    input: "test-results/fixture-extraction/fixture-extraction-report.json",
    outDir: "test-results/fixture-generation",
    minConfidence: 0.7,
    topK: 1,
    framework: "playwright",
    verifyCmd: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--input" && argv[i + 1]) {
      args.input = argv[++i];
    } else if (arg === "--outDir" && argv[i + 1]) {
      args.outDir = argv[++i];
    } else if (arg === "--minConfidence" && argv[i + 1]) {
      args.minConfidence = Number(argv[++i]);
    } else if (arg === "--topK" && argv[i + 1]) {
      args.topK = Number(argv[++i]);
    } else if (arg === "--framework" && argv[i + 1]) {
      args.framework = String(argv[++i]).toLowerCase();
    } else if (arg === "--verifyCmd" && argv[i + 1]) {
      args.verifyCmd = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    } else {
      printHelpAndExit(1, `Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.minConfidence) || args.minConfidence < 0 || args.minConfidence > 1) {
    throw new Error(`Invalid --minConfidence: ${args.minConfidence}`);
  }

  if (!Number.isInteger(args.topK) || args.topK < 1) {
    throw new Error(`Invalid --topK: ${args.topK}`);
  }

  return args;
}

function printHelpAndExit(code, message) {
  if (message) {
    console.error(`[fixture-generation-agent] ${message}`);
  }

  console.log(`
Usage:
  node agents/fixture-generation-agent.cjs \\
    --input test-results/fixture-extraction/fixture-extraction-report.json \\
    --outDir test-results/fixture-generation \\
    --minConfidence 0.70 \\
    --topK 1 \\
    --framework playwright

Options:
  --input <path>          Input extraction report JSON
  --outDir <path>         Output directory
  --minConfidence <num>   Minimum overall confidence threshold
  --topK <num>            Max number of candidates to generate
  --framework <name>      Framework target (default: playwright)
  --verifyCmd <cmd>       Optional future hook; recorded only in summary
  --help, -h              Show this help
`);
  process.exit(code);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function slugify(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}


function inferPatternType(candidate) {
const normalizedPattern =
  candidate.normalizedSetupPattern ||
  candidate.normalized_pattern ||
  candidate.pattern ||
  candidate.setupPattern ||
  (Array.isArray(candidate.normalizedLines) ? candidate.normalizedLines.join("\n") : "") ||
  "";

const pattern = String(normalizedPattern).toLowerCase();

  const hasRequestPost = pattern.includes("request.post");
  const hasPageGoto = pattern.includes("page.goto");
  const hasPageFill = pattern.includes("page.fill");
  const hasPageClick = pattern.includes("page.click");

  if (hasRequestPost && hasPageGoto && hasPageFill && hasPageClick) {
    return "api-seed-plus-ui-login";
  }

  if (hasPageGoto && hasPageFill && hasPageClick) {
    return "ui-login-or-ui-setup";
  }

  if (hasRequestPost && !hasPageGoto) {
    return "api-resource-setup";
  }

  return "generic";
}

function isSupportedCandidate(candidate, framework) {
  if (framework !== "playwright") {
    return {
      supported: false,
      reason: `Framework '${framework}' is not supported in v1`,
    };
  }

  const patternType = inferPatternType(candidate);

  if (patternType === "api-seed-plus-ui-login") {
    return { supported: true, patternType };
  }

  if (patternType === "api-resource-setup") {
    return { supported: true, patternType };
  }

  return {
    supported: false,
    reason: `Pattern type '${patternType}' is not supported in v1`,
  };
}

function buildFixtureProposal(candidate, framework) {
const fixtureName =
  candidate.candidateFixture ||
  candidate.suggestedFixture ||
  candidate.suggested_fixture ||
  candidate.fixtureName ||
  candidate.patternId ||
  candidate.id ||
  "generatedFixture";

//const fixtureName = toPascalCase(rawFixtureName);
const patternType = inferPatternType(candidate);

  const proposal = {
    candidateId: candidate.patternId || candidate.id,    fixtureName,
    framework,
    patternType,
    scope: "test",
    dependencies: [],
    dataShape: {},
    setupSteps: [],
    replacementTargets: (candidate.occurrences || []).map((occ) => ({
      file: occ.file,
      testTitle: occ.testTitle,
      lineStart: occ.lineStart,
      lineEnd: occ.lineEnd,
    })),
  };

  if (patternType === "api-seed-plus-ui-login") {
    proposal.dependencies = ["request"];
    proposal.dataShape = {
      email: "string",
      password: "string",
      token: "string",
    };
    proposal.setupSteps = [
      "register or seed user via API",
      "login user via API",
      "return authenticated context",
    ];
  } else if (patternType === "api-resource-setup") {
    proposal.dependencies = ["request"];
    proposal.dataShape = {
      resourceId: "string",
      responseBody: "object",
    };
    proposal.setupSteps = [
      "create resource via API",
      "return created resource metadata",
    ];
  } else {
    proposal.dependencies = [];
    proposal.dataShape = {};
    proposal.setupSteps = ["manual review required"];
  }

  return proposal;
}

function generatePlaywrightFixtureCode(proposal) {
  const fixtureExportName = proposal.fixtureName;

  if (proposal.patternType === "api-seed-plus-ui-login") {
    return `const { test: base } = require("@playwright/test");

exports.test = base.extend({
  ${fixtureExportName}: async ({ request }, use) => {
    const uniqueSuffix = \`\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`;
    const email = \`user_\${uniqueSuffix}@test.local\`;
    const password = "Test123!";

    const registerRes = await request.post("/api/users", {
      data: {
        user: {
          username: email,
          email,
          password,
        },
      },
    });

    if (!registerRes.ok()) {
      throw new Error(
        \`${fixtureExportName}: registration failed (\${registerRes.status()})\`
      );
    }

    const loginRes = await request.post("/api/users/login", {
      data: {
        user: { email, password },
      },
    });

    if (!loginRes.ok()) {
      throw new Error(
        \`${fixtureExportName}: login failed (\${loginRes.status()})\`
      );
    }

    const loginBody = await loginRes.json();

    await use({
      email,
      password,
      token: loginBody.user.token,
    });
  },
});
`;
  }

  if (proposal.patternType === "api-resource-setup") {
    return `const { test: base } = require("@playwright/test");

exports.test = base.extend({
  ${fixtureExportName}: async ({ request }, use) => {
    const createRes = await request.post("/api/articles", {
      data: {
        title: "Generated Title",
        description: "Generated Description",
        body: "Generated Body",
      },
    });

    if (!createRes.ok()) {
      throw new Error(
        \`${fixtureExportName}: resource creation failed (\${createRes.status()})\`
      );
    }

    const responseBody = await createRes.json();

    await use({
      resourceId: responseBody?.article?.slug || responseBody?.id || "",
      responseBody,
    });
  },
});
`;
  }

  return `// Unsupported proposal pattern type: ${proposal.patternType}
// Manual fixture design required for ${proposal.fixtureName}.
`;
}

function generateUsageMarkdown(proposal, candidate, fixtureFileName) {
  const targetLines = proposal.replacementTargets
    .map(
      (t) =>
        `- \`${t.file}\` — **${t.testTitle || "unknown test"}** (${t.lineStart || "?"}-${t.lineEnd || "?"})`
    )
    .join("\n");

  const dependencies = proposal.dependencies.length 
  
  ? proposal.dependencies.map((d) => `\`${d}\``).join(", ")
  : "none";
  
  const normalizedPattern =
  candidate.normalizedSetupPattern ||
  candidate.normalized_pattern ||
  candidate.pattern ||
  candidate.setupPattern ||
  (Array.isArray(candidate.normalizedLines) ? candidate.normalizedLines.join("\n") : "") ||
  "";

  return `# Fixture Proposal: \`${proposal.fixtureName}\`

## Summary

- Candidate ID: \`${proposal.candidateId}\`
- Framework: \`${proposal.framework}\`
- Pattern Type: \`${proposal.patternType}\`
- Scope: \`${proposal.scope}\`
- Dependencies: ${dependencies}
- Overall Confidence: ${candidate.overallConfidence}
- Rewrite Safety Score: ${candidate.rewriteSafetyScore}
- Estimated Lines Reducible: ${candidate.estimatedLinesReducible}

## Suggested Setup Steps

${proposal.setupSteps.map((step) => `- ${step}`).join("\n")}

## Suggested Data Shape

\`\`\`json
${JSON.stringify(proposal.dataShape, null, 2)}
\`\`\`

## Replacement Targets

${targetLines || "- None detected"}

## Generated Fixture File

\`${fixtureFileName}\`

## Example Usage

\`\`\`js
const { test } = require("./${path.basename(fixtureFileName)}");

test("example", async ({ ${proposal.fixtureName} }) => {
  console.log(${proposal.fixtureName});
});
\`\`\`

## Normalized Setup Pattern

\`\`\`text
${normalizedPattern}
\`\`\`

## Review Notes

- This output is **proposal-first** and should be reviewed before broad adoption.
- Source files are **not modified** by this agent.
- Verification should be added before automated rollout.
`;
}

function normalizeCandidates(report) {
  if (Array.isArray(report.candidates)) {
    return report.candidates;
  }

  if (Array.isArray(report.repeatedPatterns)) {
    return report.repeatedPatterns;
  }

  if (Array.isArray(report.patterns)) {
    return report.patterns;
  }

  return [];
}

function rankCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const c = (b.overallConfidence || 0) - (a.overallConfidence || 0);
    if (c !== 0) return c;

    const safety = (b.rewriteSafetyScore || 0) - (a.rewriteSafetyScore || 0);
    if (safety !== 0) return safety;

    return (b.estimatedLinesReducible || 0) - (a.estimatedLinesReducible || 0);
  });
}


function buildSummary(args, report, generated, skipped) {
  return {
    schemaVersion: "1.0.0",
    agent: "fixture_generation",
    generatedAt: new Date().toISOString(),
    input: {
      path: path.resolve(args.input),
      framework: args.framework,
      minConfidence: args.minConfidence,
      topK: args.topK,
      verifyCmd: args.verifyCmd || null,
    },
    sourceReportMeta: {
      repo: report.repo || null,
      scannedTestFiles: report.scannedTestFiles || null,
      repeatedPatterns: report.repeatedPatterns || null,
      totalOccurrences: report.totalOccurrences || null,
    },
    generatedCount: generated.length,
    skippedCount: skipped.length,
    generated,
    skipped,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input);
  const outDir = path.resolve(args.outDir);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input report not found: ${inputPath}`);
  }

  ensureDir(outDir);

  const report = readJson(inputPath);
  const allCandidates = normalizeCandidates(report);

//   console.log("[DEBUG] Candidate:", {
//   id: candidate.id,
//   fixture: candidate.suggestedFixture,
//   pattern: normalizedPattern.slice(0, 200),
// });

  if (!allCandidates.length) {
    throw new Error("No candidates found in extraction report");
  }

  const ranked = rankCandidates(allCandidates);

  const generated = [];
  const skipped = [];

for (const candidate of ranked) {
  const confidence = candidate.overallConfidence ?? candidate.confidence ?? 0;
  const fixtureName =
  candidate.candidateFixture ||
  candidate.suggestedFixture ||
  candidate.suggested_fixture ||
  candidate.fixtureName ||
  candidate.patternId ||
  candidate.id ||
  "generatedFixture";

const normalizedPattern =
  candidate.normalizedSetupPattern ||
  candidate.normalized_pattern ||
  candidate.pattern ||
  candidate.setupPattern ||
  (Array.isArray(candidate.normalizedLines) ? candidate.normalizedLines.join("\n") : "") ||
  "";

console.log("[DEBUG] Candidate:", {
   id: candidate.patternId || candidate.id,
   fixtureName,
   confidence,
   patternPreview: String(normalizedPattern).slice(0, 200),
   });

  if (confidence < args.minConfidence) {
    skipped.push({
      candidateId: candidate.id,
      fixtureName,
      reason: `Below confidence threshold (${confidence} < ${args.minConfidence})`,
    });
    continue;
  }

  const support = isSupportedCandidate(candidate, args.framework);
  if (!support.supported) {
    if (inferPatternType(candidate) === "generic") {
      console.log(
        `[fixture-generation-agent] Fallback generation for generic pattern: ${fixtureName}`
      );
    } else {
      skipped.push({
        candidateId: candidate.id,
        fixtureName,
        reason: support.reason,
      });
      continue;
    }
  }

  if (generated.length >= args.topK) {
    skipped.push({
      candidateId: candidate.id,
      fixtureName,
      reason: `Exceeded topK limit (${args.topK})`,
    });
    continue;
  }

  const proposal = buildFixtureProposal(candidate, args.framework);
  const baseName = `${slugify(proposal.fixtureName)}.fixture`;
  const fixtureFileName = path.join(outDir, `${baseName}.js`);
  const usageFileName = path.join(outDir, `${baseName}.usage.md`);
  const proposalFileName = path.join(outDir, `${baseName}.proposal.json`);

  writeText(fixtureFileName, generatePlaywrightFixtureCode(proposal));
  writeText(usageFileName, generateUsageMarkdown(proposal, candidate, fixtureFileName));
  writeText(proposalFileName, JSON.stringify(proposal, null, 2));

  generated.push({
    candidateId: candidate.id,
    fixtureName: proposal.fixtureName,
    patternType: proposal.patternType,
    confidence,
    fixtureFile: fixtureFileName,
    usageFile: usageFileName,
    proposalFile: proposalFileName,
    status: "generated_unverified",
  });
}

  const summary = buildSummary(args, report, generated, skipped);
  const summaryPath = path.join(outDir, "fixture-generation-report.json");
  const summaryMdPath = path.join(outDir, "fixture-generation-report.md");

  writeText(summaryPath, JSON.stringify(summary, null, 2));
  writeText(
    summaryMdPath,
    [
      "# Fixture Generation Report",
      "",
      `- Generated At: ${summary.generatedAt}`,
      `- Input: ${summary.input.path}`,
      `- Framework: ${summary.input.framework}`,
      `- Generated Fixtures: ${summary.generatedCount}`,
      `- Skipped Candidates: ${summary.skippedCount}`,
      "",
      "## Generated",
      "",
      ...(generated.length
        ? generated.map(
            (g) =>
              `- \`${g.fixtureName}\` (${g.patternType}) → \`${path.relative(process.cwd(), g.fixtureFile)}\``
          )
        : ["- None"]),
      "",
      "## Skipped",
      "",
      ...(skipped.length
        ? skipped.map((s) => `- \`${s.fixtureName}\` — ${s.reason}`)
        : ["- None"]),
      "",
    ].join("\n")
  );

  console.log(`[fixture-generation-agent] Wrote ${summaryPath}`);
  console.log(`[fixture-generation-agent] Wrote ${summaryMdPath}`);

  for (const item of generated) {
    console.log(
      `[fixture-generation-agent] Generated fixture: ${item.fixtureName} -> ${item.fixtureFile}`
    );
  }
}

try {
  main();
} catch (error) {
  console.error(`[fixture-generation-agent] Fatal error: ${error.message}`);
  process.exit(1);
}
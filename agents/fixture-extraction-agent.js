#!/usr/bin/env node

/**
 * Fixture Extraction Agent — V1
 *
 * Purpose:
 * - Scan Playwright test files
 * - Detect repeated inline setup candidates
 * - Report file / test / line ranges
 * - Rank clusters that look like fixture opportunities
 *
 * V1 intentionally does NOT:
 * - rewrite tests
 * - run traces
 * - infer APIs
 *
 * Output:
 * - <outDir>/fixture-extraction-report.json
 * - <outDir>/fixture-extraction-report.md
 *
 * Example:
 *   node agents/fixture-extraction-agent.js \
 *     --repo . \
 *     --outDir test-results/fixture-extraction \
 *     --minOccurrences 3
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_MIN_OCCURRENCES = 3;
const DEFAULT_OUT_DIR = "test-results/fixture-extraction";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "test-results",
  ".next",
  ".turbo",
  ".cache",
]);

const TEST_FILE_REGEX =
  /\.(spec|test)\.(js|cjs|mjs|ts|cts|mts|jsx|tsx)$/i;

function parseArgs(argv) {
  const args = {
    repo: ".",
    outDir: DEFAULT_OUT_DIR,
    minOccurrences: DEFAULT_MIN_OCCURRENCES,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--repo" && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (arg === "--outDir" && argv[i + 1]) {
      args.outDir = argv[++i];
    } else if (arg === "--minOccurrences" && argv[i + 1]) {
      args.minOccurrences = Number(argv[++i]);
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    } else {
      console.warn(`[fixture-extraction-agent] Ignoring unknown arg: ${arg}`);
    }
  }

  if (!Number.isInteger(args.minOccurrences) || args.minOccurrences < 2) {
    throw new Error("--minOccurrences must be an integer >= 2");
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`
Fixture Extraction Agent — V1

Usage:
  node agents/fixture-extraction-agent.js --repo . --outDir test-results/fixture-extraction

Options:
  --repo <path>            Root repository path to scan
  --outDir <path>          Output directory for artifacts
  --minOccurrences <n>     Minimum repeated occurrences (default: 3)
  --verbose                Print extra scan information
  --help, -h               Show this help
`);
  process.exit(code);
}

function walkFiles(rootDir) {
  const results = [];

  function walk(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      console.warn(`[fixture-extraction-agent] Failed to read dir: ${currentDir}`, error.message);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && TEST_FILE_REGEX.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.warn(`[fixture-extraction-agent] Failed to read file: ${filePath}`, error.message);
    return null;
  }
}

function getLineOffsets(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function offsetToLineNumber(offset, lineOffsets) {
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineOffsets[mid] <= offset) {
      if (mid === lineOffsets.length - 1 || lineOffsets[mid + 1] > offset) {
        return mid + 1;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return 1;
}

function findMatchingBrace(text, openBraceIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = openBraceIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (!escaped && ch === "'") inSingle = false;
      escaped = !escaped && ch === "\\";
      continue;
    }

    if (inDouble) {
      if (!escaped && ch === '"') inDouble = false;
      escaped = !escaped && ch === "\\";
      continue;
    }

    if (inTemplate) {
      if (!escaped && ch === "`") inTemplate = false;
      escaped = !escaped && ch === "\\";
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      escaped = false;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      escaped = false;
      continue;
    }

    if (ch === "`") {
      inTemplate = true;
      escaped = false;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function extractTestBlocks(fileContent) {
  const blocks = [];
  const testCallRegex =
    /\b(?:test|it)(?:\.(?:only|skip|fixme|fail))?\s*\(\s*(['"`])([\s\S]*?)\1\s*,/g;

  let match;
  while ((match = testCallRegex.exec(fileContent)) !== null) {
    const testTitle = match[2];
    const callStart = match.index;
    const afterTitleIndex = testCallRegex.lastIndex;

    const arrowIndex = fileContent.indexOf("=>", afterTitleIndex);
    if (arrowIndex === -1) continue;

    const openBraceIndex = fileContent.indexOf("{", arrowIndex);
    if (openBraceIndex === -1) continue;

    const closeBraceIndex = findMatchingBrace(fileContent, openBraceIndex);
    if (closeBraceIndex === -1) continue;

    const bodyStart = openBraceIndex + 1;
    const bodyEnd = closeBraceIndex;
    const body = fileContent.slice(bodyStart, bodyEnd);

    blocks.push({
      testTitle,
      callStart,
      bodyStart,
      bodyEnd,
      body,
    });

    testCallRegex.lastIndex = closeBraceIndex + 1;
  }

  return blocks;
}

function isIgnorableLine(trimmed) {
  if (!trimmed) return true;
  if (trimmed === "{") return true;
  if (trimmed === "}") return true;
  if (trimmed.startsWith("//")) return true;
  if (trimmed.startsWith("/*")) return true;
  if (trimmed.startsWith("*")) return true;
  return false;
}

function isAssertionLine(trimmed) {
  return (
    /\bexpect\s*\(/.test(trimmed) ||
    /\bassert(?:ion)?\b/i.test(trimmed) ||
    /\.to(Have|Be|Equal|Contain|Match)/.test(trimmed)
  );
}

function looksLikeActionLine(trimmed) {
  return (
    trimmed.startsWith("await ") ||
    trimmed.startsWith("const ") ||
    trimmed.startsWith("let ") ||
    trimmed.startsWith("var ") ||
    trimmed.startsWith("page.") ||
    trimmed.startsWith("browser.") ||
    trimmed.startsWith("context.") ||
    trimmed.startsWith("request.") ||
    trimmed.startsWith("api.") ||
    trimmed.includes(".click(") ||
    trimmed.includes(".fill(") ||
    trimmed.includes(".goto(") ||
    trimmed.includes(".check(") ||
    trimmed.includes(".press(") ||
    trimmed.includes(".selectOption(") ||
    trimmed.includes(".setInputFiles(") ||
    trimmed.includes("login(") ||
    trimmed.includes("signIn(") ||
    trimmed.includes("create") ||
    trimmed.includes("seed") ||
    trimmed.includes("setup")
  );
}

function isExplicitWaitNoise(trimmed) {
  return (
    trimmed.includes("waitForTimeout(") ||
    trimmed.includes("page.pause(") ||
    trimmed.includes("console.log(")
  );
}

function normalizeLine(line) {
  return line
    .replace(/\/\/.*$/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/`[^`]*`/g, "`<str>`")
    .replace(/"[^"]*"/g, '"<str>"')
    .replace(/'[^']*'/g, "'<str>'")
    .replace(/\b\d+\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSetupCandidate(testBlock, fileContent, lineOffsets) {
  const bodyLines = testBlock.body.split("\n");
  const setupLines = [];
  const lineRefs = [];

  let foundMeaningfulLine = false;
  let stopped = false;
  let localOffset = 0;

  for (let i = 0; i < bodyLines.length; i += 1) {
    const rawLine = bodyLines[i];
    const trimmed = rawLine.trim();

    const absoluteOffset = testBlock.bodyStart + localOffset;
    const lineNumber = offsetToLineNumber(absoluteOffset, lineOffsets);
    localOffset += rawLine.length + 1;

    if (isIgnorableLine(trimmed)) {
      if (!foundMeaningfulLine) {
        continue;
      }
      if (!stopped) {
        setupLines.push(rawLine);
        lineRefs.push(lineNumber);
      }
      continue;
    }

    if (isAssertionLine(trimmed)) {
      stopped = true;
      break;
    }

    if (!foundMeaningfulLine && !looksLikeActionLine(trimmed)) {
      continue;
    }

    if (isExplicitWaitNoise(trimmed)) {
      continue;
    }

    foundMeaningfulLine = true;

    if (stopped) break;
    setupLines.push(rawLine);
    lineRefs.push(lineNumber);

    // Soft stop: once we hit assertion-ish comments or clear validation helpers.
    if (
      trimmed.includes("verify") ||
      trimmed.includes("assert") ||
      trimmed.includes("expect")
    ) {
      stopped = true;
      break;
    }
  }

  const meaningfulLines = setupLines
    .map((line) => line.trim())
    .filter((line) => !isIgnorableLine(line) && !isExplicitWaitNoise(line));

  if (meaningfulLines.length < 3) {
    return null;
  }

  const normalizedLines = meaningfulLines.map(normalizeLine);

  const setupLikelihoodSignals = {
    hasAuth: normalizedLines.some((l) => /login|signin|authenticate/.test(l)),
    hasCreate: normalizedLines.some((l) => /create|new |submit|save/.test(l)),
    hasNavigation: normalizedLines.some((l) => /\.goto\(|navigate/.test(l)),
    hasFill: normalizedLines.some((l) => /\.fill\(/.test(l)),
    hasClick: normalizedLines.some((l) => /\.click\(/.test(l)),
    hasApi: normalizedLines.some((l) => /\bapi\.|request\./.test(l)),
  };

  const setupLikelihoodScore = computeSetupLikelihoodScore(
    meaningfulLines,
    setupLikelihoodSignals
  );

  return {
    testTitle: testBlock.testTitle,
    lineStart: Math.min(...lineRefs),
    lineEnd: Math.max(...lineRefs),
    originalLines: meaningfulLines,
    normalizedLines,
    normalizedKey: normalizedLines.join("\n"),
    setupLikelihoodScore,
    setupLikelihoodSignals,
  };
}

function computeSetupLikelihoodScore(lines, signals) {
  let score = 0.35;

  if (signals.hasAuth) score += 0.20;
  if (signals.hasCreate) score += 0.15;
  if (signals.hasNavigation) score += 0.10;
  if (signals.hasFill) score += 0.05;
  if (signals.hasClick) score += 0.05;
  if (signals.hasApi) score += 0.10;

  if (lines.length >= 4) score += 0.05;
  if (lines.length >= 6) score += 0.05;

  return Math.min(0.99, Number(score.toFixed(2)));
}

function suggestFixtureName(cluster) {
  const allLines = cluster.occurrences.flatMap((o) => o.normalizedLines).join(" ").toLowerCase();

  if (allLines.includes("login") || allLines.includes("signin")) {
    if (allLines.includes("admin")) return "authenticatedAdmin";
    if (allLines.includes("editor")) return "authenticatedEditor";
    return "authenticatedUser";
  }

  if (allLines.includes("project")) return "projectWithOwner";
  if (allLines.includes("article")) return "publishedArticle";
  if (allLines.includes("account")) return "accountFixture";
  if (allLines.includes("profile")) return "userProfileFixture";
  if (allLines.includes("billing")) return "accountWithBillingProfile";

  return "stateFixture";
}

function makePatternId(cluster) {
  const base = suggestFixtureName(cluster)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();

  return `setup.${base}`;
}

function relativePathSafe(root, fullPath) {
  return path.relative(root, fullPath).split(path.sep).join("/");
}

function groupCandidates(candidates, minOccurrences) {
  const groups = new Map();

  for (const candidate of candidates) {
    if (!groups.has(candidate.normalizedKey)) {
      groups.set(candidate.normalizedKey, []);
    }
    groups.get(candidate.normalizedKey).push(candidate);
  }

  const clusters = [];

  for (const [normalizedKey, occurrences] of groups.entries()) {
    if (occurrences.length < minOccurrences) continue;

    const occurrencePaths = new Set(occurrences.map((o) => o.file));
    const avgSetupLikelihood =
      occurrences.reduce((sum, o) => sum + o.setupLikelihoodScore, 0) / occurrences.length;

    const repetitionScore = computeRepetitionScore(
      occurrences.length,
      occurrencePaths.size
    );

    const estimatedLinesReducible = occurrences.reduce(
      (sum, o) => sum + (o.lineEnd - o.lineStart + 1),
      0
    );

    const cluster = {
      patternId: "pending",
      occurrences,
      occurrenceCount: occurrences.length,
      uniqueFiles: occurrencePaths.size,
      normalizedLines: normalizedKey.split("\n"),
      repetitionScore,
      setupLikelihoodScore: Number(avgSetupLikelihood.toFixed(2)),
      rewriteSafetyScore: computeRewriteSafetyScore(avgSetupLikelihood, occurrences),
      estimatedLinesReducible,
      candidateFixture: "pending",
      overallConfidence: 0,
    };

    cluster.candidateFixture = suggestFixtureName(cluster);
    cluster.patternId = makePatternId(cluster);
    cluster.overallConfidence = computeOverallConfidence(cluster);

    clusters.push(cluster);
  }

  clusters.sort((a, b) => {
    if (b.overallConfidence !== a.overallConfidence) {
      return b.overallConfidence - a.overallConfidence;
    }
    return b.occurrenceCount - a.occurrenceCount;
  });

  return clusters;
}

function computeRepetitionScore(occurrenceCount, uniqueFiles) {
  let score = 0.4;

  if (occurrenceCount >= 3) score += 0.15;
  if (occurrenceCount >= 5) score += 0.10;
  if (occurrenceCount >= 8) score += 0.10;

  if (uniqueFiles >= 2) score += 0.10;
  if (uniqueFiles >= 4) score += 0.10;

  return Math.min(0.99, Number(score.toFixed(2)));
}

function computeRewriteSafetyScore(avgSetupLikelihood, occurrences) {
  let score = 0.45;

  if (avgSetupLikelihood >= 0.65) score += 0.15;
  if (avgSetupLikelihood >= 0.80) score += 0.10;

  const allTitles = occurrences.map((o) => o.testTitle.toLowerCase());
  const titleDiversity = new Set(allTitles).size;

  if (titleDiversity >= 2) score += 0.05;
  if (titleDiversity >= 4) score += 0.05;

  return Math.min(0.90, Number(score.toFixed(2)));
}

function computeOverallConfidence(cluster) {
  const score =
    cluster.repetitionScore * 0.35 +
    cluster.setupLikelihoodScore * 0.40 +
    cluster.rewriteSafetyScore * 0.25;

  return Number(score.toFixed(2));
}

function renderMarkdown(report) {
  const lines = [];

  lines.push("# Fixture Extraction Report");
  lines.push("");
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push(`- Repo: ${report.repo}`);
  lines.push(`- Scanned Test Files: ${report.summary.scannedTestFiles}`);
  lines.push(`- Repeated Patterns: ${report.summary.repeatedPatterns}`);
  lines.push(`- Total Occurrences: ${report.summary.totalOccurrences}`);
  lines.push(`- High Confidence Candidates: ${report.summary.highConfidenceCandidates}`);
  lines.push(`- Estimated Lines Reducible: ${report.summary.estimatedLinesReducible}`);
  lines.push("");

  if (report.candidates.length === 0) {
    lines.push("No repeated setup candidates met the threshold.");
    lines.push("");
    return lines.join("\n");
  }

  for (const candidate of report.candidates) {
    lines.push(`## ${candidate.patternId}`);
    lines.push("");
    lines.push(`- Suggested Fixture: \`${candidate.candidateFixture}\``);
    lines.push(`- Occurrences: ${candidate.occurrenceCount}`);
    lines.push(`- Unique Files: ${candidate.uniqueFiles}`);
    lines.push(`- Repetition Score: ${candidate.repetitionScore}`);
    lines.push(`- Setup Likelihood Score: ${candidate.setupLikelihoodScore}`);
    lines.push(`- Rewrite Safety Score: ${candidate.rewriteSafetyScore}`);
    lines.push(`- Overall Confidence: ${candidate.overallConfidence}`);
    lines.push(`- Estimated Lines Reducible: ${candidate.estimatedLinesReducible}`);
    lines.push("");

    lines.push("### Normalized Setup Pattern");
    lines.push("");
    lines.push("```text");
    for (const line of candidate.normalizedLines) {
      lines.push(line);
    }
    lines.push("```");
    lines.push("");

    lines.push("### Occurrences");
    lines.push("");

    for (const occ of candidate.occurrences) {
      lines.push(
        `- \`${occ.file}\` — **${occ.testTitle}** (lines ${occ.lineStart}-${occ.lineEnd})`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.repo);
  const outDir = path.resolve(args.outDir);

  if (!fs.existsSync(repoRoot)) {
    throw new Error(`Repo path does not exist: ${repoRoot}`);
  }

  const testFiles = walkFiles(repoRoot);

  if (args.verbose) {
    console.log(`[fixture-extraction-agent] Found ${testFiles.length} test files`);
  }

  const allCandidates = [];

  for (const filePath of testFiles) {
    const content = readFileSafe(filePath);
    if (!content) continue;

    const lineOffsets = getLineOffsets(content);
    const testBlocks = extractTestBlocks(content);

    if (args.verbose) {
      console.log(
        `[fixture-extraction-agent] ${relativePathSafe(repoRoot, filePath)} -> ${testBlocks.length} test blocks`
      );
    }

    for (const testBlock of testBlocks) {
      const candidate = buildSetupCandidate(testBlock, content, lineOffsets);
      if (!candidate) continue;

      allCandidates.push({
        file: relativePathSafe(repoRoot, filePath),
        ...candidate,
      });
    }
  }

  const clusters = groupCandidates(allCandidates, args.minOccurrences);

  const summary = {
    scannedTestFiles: testFiles.length,
    repeatedPatterns: clusters.length,
    totalOccurrences: clusters.reduce((sum, c) => sum + c.occurrenceCount, 0),
    highConfidenceCandidates: clusters.filter((c) => c.overallConfidence >= 0.8).length,
    estimatedLinesReducible: clusters.reduce((sum, c) => sum + c.estimatedLinesReducible, 0),
  };

  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    repo: repoRoot,
    summary,
    candidates: clusters.map((cluster) => ({
      patternId: cluster.patternId,
      candidateFixture: cluster.candidateFixture,
      occurrenceCount: cluster.occurrenceCount,
      uniqueFiles: cluster.uniqueFiles,
      repetitionScore: cluster.repetitionScore,
      setupLikelihoodScore: cluster.setupLikelihoodScore,
      rewriteSafetyScore: cluster.rewriteSafetyScore,
      overallConfidence: cluster.overallConfidence,
      estimatedLinesReducible: cluster.estimatedLinesReducible,
      normalizedLines: cluster.normalizedLines,
      occurrences: cluster.occurrences.map((occ) => ({
        file: occ.file,
        testTitle: occ.testTitle,
        lineStart: occ.lineStart,
        lineEnd: occ.lineEnd,
        setupLikelihoodScore: occ.setupLikelihoodScore,
        setupLikelihoodSignals: occ.setupLikelihoodSignals,
        originalLines: occ.originalLines,
      })),
    })),
  };

  ensureDir(outDir);

  const jsonPath = path.join(outDir, "fixture-extraction-report.json");
  const mdPath = path.join(outDir, "fixture-extraction-report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf8");

  console.log(`[fixture-extraction-agent] Wrote ${jsonPath}`);
  console.log(`[fixture-extraction-agent] Wrote ${mdPath}`);

  if (clusters.length > 0) {
    console.log("");
    console.log("[fixture-extraction-agent] Top candidates:");
    for (const cluster of clusters.slice(0, 5)) {
      console.log(
        `  - ${cluster.patternId} | fixture=${cluster.candidateFixture} | occurrences=${cluster.occurrenceCount} | confidence=${cluster.overallConfidence}`
      );
    }
  } else {
    console.log("[fixture-extraction-agent] No repeated setup candidates met the threshold.");
  }
}

try {
  main();
} catch (error) {
  console.error("[fixture-extraction-agent] Fatal error:", error.message);
  process.exit(1);
}

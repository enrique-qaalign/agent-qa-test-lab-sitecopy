#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const reportPath = process.argv[2] || "out/advisory-report.json";
const assessmentPath = process.argv[3] || "out/framework-assessment.json";
const routingPath = process.argv[4] || "out/sprint-routing.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugToTitle(id) {
  return String(id || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const templates = {
  "selenium-shared-browser-session-risk": {
    pattern: "Selenium WebDriver/session lifecycle is not clearly isolated per test or worker.",
    intent: "Make browser lifecycle ownership explicit so tests do not bleed state across scenarios or parallel workers.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/*Test*.java",
      "src/test/java/**/Driver*.java",
      "src/test/java/**/Config*.java"
    ],
    steps: [
      "Locate all RemoteWebDriver/WebDriver creation paths.",
      "Ensure each test or isolated worker owns a deterministic driver lifecycle.",
      "Move setup into a clear before-test/before-method boundary.",
      "Ensure teardown always calls quit() when driver creation succeeded.",
      "Remove ThreadLocal driver values after teardown to avoid stale references."
    ],
    doNot: [
      "Do not reuse one WebDriver across unrelated tests to improve speed.",
      "Do not hide driver lifecycle behind static mutable globals.",
      "Do not remove parallel execution until lifecycle behavior is proven unsafe."
    ],
    verify: [
      "Run the affected TestNG suite twice in a row.",
      "Run the suite with parallel execution enabled.",
      "Confirm no test depends on browser state from a previous test."
    ],
    expectedImpact: "Improves release confidence by reducing state bleed and order-dependent behavior."
  },

  "selenium-parallel-driver-lifecycle-risk": {
    pattern: "Parallel Selenium execution uses ThreadLocal/session patterns that need explicit ownership and cleanup.",
    intent: "Harden parallel execution so each worker has its own driver, session id, and test data boundary.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/*Test*.java",
      "testng.xml",
      "pom.xml"
    ],
    steps: [
      "Inspect ThreadLocal<WebDriver> and ThreadLocal session-id usage.",
      "Ensure ThreadLocal values are removed in teardown after quit().",
      "Confirm each DataProvider row uses isolated browser/session data.",
      "Ensure shared fields are immutable or scoped per test instance.",
      "Validate parallel execution at the configured thread count."
    ],
    doNot: [
      "Do not use static mutable test state for browser/session data.",
      "Do not suppress parallelism without documenting why.",
      "Do not assume ThreadLocal is safe unless cleanup is verified."
    ],
    verify: [
      "Run mvn test with parallel execution enabled.",
      "Run a repeated parallel test loop if available.",
      "Confirm session IDs are unique per active test worker."
    ],
    expectedImpact: "Reduces flake risk caused by cross-thread driver/session contamination."
  },

  "selenium-parallel-overcommit-risk": {
    pattern: "Parallel execution configuration may exceed stable framework or cloud-grid capacity.",
    intent: "Align parallelism with available grid capacity, driver lifecycle safety, and CI reliability.",
    likelyFiles: [
      "pom.xml",
      "testng.xml",
      ".github/workflows/*.yml",
      ".gitlab-ci.yml",
      "Jenkinsfile"
    ],
    steps: [
      "Find Surefire/TestNG parallel settings and configured thread count.",
      "Compare configured thread count with Sauce/grid concurrency limits.",
      "Set a conservative default thread count for CI.",
      "Make thread count configurable through an environment variable.",
      "Document local vs CI parallel execution defaults."
    ],
    doNot: [
      "Do not hardcode a high thread count without a grid capacity contract.",
      "Do not tune flakiness by only increasing timeouts.",
      "Do not mix class-level and DataProvider-level parallelism without clear limits."
    ],
    verify: [
      "Run mvn test with the configured CI thread count.",
      "Confirm no session creation failures or grid capacity errors.",
      "Review CI duration and failure stability across repeated runs."
    ],
    expectedImpact: "Reduces infrastructure-driven flakes and false release failures."
  },

  "selenium-debug-artifact-gap": {
    pattern: "Failure hooks exist, but failures do not reliably capture screenshot, page source, browser logs, or equivalent artifacts.",
    intent: "Make failed Selenium runs diagnosable without rerunning tests.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/*Listener*.java",
      "src/test/java/**/*Test*.java",
      "pom.xml",
      "Jenkinsfile",
      ".gitlab-ci.yml",
      ".github/workflows/*.yml"
    ],
    steps: [
      "Locate @AfterMethod, ITestListener, or failure hook logic.",
      "On failure, capture screenshot using TakesScreenshot when supported.",
      "Capture page source into a text/html artifact.",
      "Capture browser logs where supported by the driver/grid.",
      "Write artifacts to a deterministic folder such as target/qa-align-artifacts.",
      "Ensure CI preserves that artifact folder."
    ],
    doNot: [
      "Do not rely only on console logs.",
      "Do not require rerunning a test to understand the first failure.",
      "Do not store artifacts in random temp paths that CI will not publish."
    ],
    verify: [
      "Force one test failure intentionally.",
      "Confirm screenshot, page source, and logs are written.",
      "Confirm CI output links or stores the artifacts."
    ],
    expectedImpact: "Improves diagnosability and supports artifact-driven debugging."
  },

  "selenium-page-object-responsibility-mixing": {
    pattern: "Page Objects appear to mix navigation, actions, waits, assertions, or test intent.",
    intent: "Separate page mechanics from test assertions so failures point to the right layer.",
    likelyFiles: [
      "src/test/java/**/Pages/**/*.java",
      "src/test/java/**/*Page*.java",
      "src/test/java/**/*Test*.java"
    ],
    steps: [
      "Identify Page Object methods that assert, wait, navigate, and act in one method.",
      "Keep locators and user actions in Page Objects.",
      "Move assertions into test/spec classes or assertion helper classes.",
      "Give wait helpers clear names tied to page readiness.",
      "Avoid changing user-flow intent while refactoring."
    ],
    doNot: [
      "Do not rewrite the entire Page Object model in one pass.",
      "Do not move all waits blindly into tests.",
      "Do not remove assertions without replacing them in the correct layer."
    ],
    verify: [
      "Run affected test classes.",
      "Confirm failure messages still identify expected vs actual behavior.",
      "Confirm Page Object methods remain reusable without hiding assertions."
    ],
    expectedImpact: "Improves maintainability and reduces ambiguous failure causes."
  },

  "selenium-dependency-obsolescence-risk": {
    pattern: "Selenium/TestNG/Maven/Java versions are old enough to create modernization and CI compatibility risk.",
    intent: "Create a controlled dependency modernization path without destabilizing the whole suite.",
    likelyFiles: [
      "pom.xml",
      ".mvn/",
      "Jenkinsfile",
      ".gitlab-ci.yml",
      ".github/workflows/*.yml"
    ],
    steps: [
      "Record current Selenium, TestNG, Surefire, compiler, and Java versions.",
      "Upgrade in controlled stages rather than all at once.",
      "Start with build plugin/compiler compatibility.",
      "Then update TestNG/Surefire execution behavior.",
      "Then update Selenium/grid capabilities and driver options.",
      "Run smoke tests after each stage."
    ],
    doNot: [
      "Do not jump directly from Selenium 3 to Selenium 4 without a compatibility pass.",
      "Do not modernize dependencies and refactor tests in the same PR if avoidable.",
      "Do not ignore Java target/source compatibility."
    ],
    verify: [
      "Run mvn test-compile.",
      "Run a minimal smoke suite.",
      "Run one full CI pass after each modernization stage."
    ],
    expectedImpact: "Reduces CI drift, dependency fragility, and modernization risk."
  },

  "cloud-credential-contract-risk": {
    pattern: "Cloud/grid credentials are required but not validated before test execution.",
    intent: "Fail fast with a clear environment contract instead of failing late during driver creation.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/Config*.java",
      "README.md",
      "Jenkinsfile",
      ".gitlab-ci.yml",
      ".github/workflows/*.yml"
    ],
    steps: [
      "Create a small config/preflight helper for required environment variables.",
      "Validate SAUCE_USERNAME, SAUCE_ACCESS_KEY, grid URL, and build tag inputs before driver creation.",
      "Return clear error messages for missing or blank values.",
      "Document required variables in README and CI config.",
      "Add a smoke command that validates config without launching the full suite."
    ],
    doNot: [
      "Do not allow null credentials to reach RemoteWebDriver.",
      "Do not print secret values in logs.",
      "Do not bury environment validation inside unrelated test code."
    ],
    verify: [
      "Run with missing SAUCE_ACCESS_KEY and confirm a clear preflight failure.",
      "Run with valid credentials and confirm driver creation still works.",
      "Check logs for secret leakage."
    ],
    expectedImpact: "Improves environment reproducibility and lowers setup/debug time."
  },

  "remote-grid-credential-url-risk": {
    pattern: "RemoteWebDriver URL appears to compose credentials directly into the grid URL.",
    intent: "Reduce the chance of credentials leaking through URL strings, logs, exceptions, or telemetry.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/*Driver*.java",
      "src/test/java/**/Config*.java"
    ],
    steps: [
      "Find RemoteWebDriver URL construction.",
      "Move grid URL and credentials into a dedicated configuration object.",
      "Avoid logging full URLs that include credentials.",
      "Prefer provider-supported capability/auth configuration when available.",
      "Sanitize any exception/log output that may contain credentials."
    ],
    doNot: [
      "Do not print the full remote URL.",
      "Do not hardcode access keys in source files.",
      "Do not pass secrets through test names or annotations."
    ],
    verify: [
      "Run with valid credentials and confirm remote session creation.",
      "Force a bad credential failure and confirm logs do not expose secrets.",
      "Search logs for SAUCE_ACCESS_KEY or credential-bearing URLs."
    ],
    expectedImpact: "Reduces secret exposure risk and improves cloud execution hygiene."
  },

  "selenium-assertion-correctness-risk": {
    pattern: "Java string reference comparison was detected in an assertion path.",
    intent: "Prevent false confidence caused by reference equality instead of value equality.",
    likelyFiles: [
      "src/test/java/**/*.java",
      "src/main/java/**/*.java",
      "Page Object helper methods",
      "Assertion helper methods"
    ],
    steps: [
      "Search for String comparisons using == or !=.",
      "Replace with .equals(...), .equalsIgnoreCase(...), or Objects.equals(...) as appropriate.",
      "Review helper methods returning boolean values used by assertions.",
      "Add or adjust a focused regression check for the corrected helper."
    ],
    doNot: [
      "Do not suppress the assertion to make the test pass.",
      "Do not change test intent while fixing equality semantics.",
      "Do not rewrite unrelated assertions in the same change unless they share the same pattern."
    ],
    verify: [
      "Run the affected TestNG class.",
      "Run mvn test if the suite is small enough.",
      "Confirm assertion behavior fails when the title/text is intentionally wrong."
    ],
    expectedImpact: "Reduces false-signal risk from tests that can be green for the wrong reason."
  },

  "sauce-job-artifact-link-gap": {
    pattern: "Sauce job/session data exists but may not be published as a CI-visible diagnostic artifact.",
    intent: "Make remote cloud execution evidence accessible from the test output or CI job.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/*Listener*.java",
      "Jenkinsfile",
      ".gitlab-ci.yml",
      ".github/workflows/*.yml"
    ],
    steps: [
      "Locate where sessionId is captured.",
      "Build a sanitized Sauce job URL from the session id and account context.",
      "Write job URLs to console and/or a deterministic artifact file.",
      "Attach the artifact file in CI.",
      "Ensure failed test records include the matching job/session URL."
    ],
    doNot: [
      "Do not expose access keys in generated URLs.",
      "Do not require engineers to manually search the Sauce dashboard by timestamp.",
      "Do not store job links only in local machine output."
    ],
    verify: [
      "Run one passing and one failing remote test.",
      "Confirm Sauce job URLs are visible in CI/log artifacts.",
      "Confirm links map to the correct test sessions."
    ],
    expectedImpact: "Reduces triage time for remote/grid failures."
  },

  "environment-and-matrix-hardcoding-risk": {
    pattern: "Browser/platform matrix or target URL is hardcoded in source.",
    intent: "Move environment and matrix choices into configuration so CI and local runs are reproducible.",
    likelyFiles: [
      "src/test/java/**/*Base*.java",
      "src/test/java/**/*Test*.java",
      "src/test/resources/**/*.properties",
      "pom.xml",
      "testng.xml"
    ],
    steps: [
      "Find hardcoded target URLs and browser/platform values.",
      "Create a config profile for base URL, browser, version, platform, and grid target.",
      "Set defaults for local execution.",
      "Allow CI to override through environment variables or a properties file.",
      "Document supported matrix profiles."
    ],
    doNot: [
      "Do not bury environment selection inside test methods.",
      "Do not mix sample/demo URLs with production target configuration.",
      "Do not make engineers edit source code to change browsers."
    ],
    verify: [
      "Run one local/default profile.",
      "Run one CI/grid profile.",
      "Confirm target URL and browser matrix can be changed without editing Java source."
    ],
    expectedImpact: "Improves maintainability, CI portability, and assessment repeatability."
  }
};

function fallbackTemplate(findingId) {
  return {
    pattern: `Detected framework risk pattern: ${findingId}`,
    intent: "Reduce the risk represented by this finding without changing unrelated test behavior.",
    likelyFiles: [
      "Review files referenced in validation evidence.",
      "Review framework setup, test base, and CI configuration."
    ],
    steps: [
      "Review the finding evidence.",
      "Locate the smallest safe code area responsible for the pattern.",
      "Apply a focused fix.",
      "Run the narrowest relevant validation first.",
      "Then rerun the full assessment."
    ],
    doNot: [
      "Do not perform broad rewrites without preserving test intent.",
      "Do not hide the symptom without correcting the pattern.",
      "Do not skip validation."
    ],
    verify: [
      "Run the affected test area.",
      "Rerun QA ALIGN assessment.",
      "Confirm trust level or finding count improves."
    ],
    expectedImpact: "Reduces framework risk associated with this finding."
  };
}

function normalizeFinding(item) {
  return {
    id: item.title || item.id,
    severity: item.severity || "unknown",
    impact: item.impact || item.releaseImpact || "unknown",
    detail: item.detail || item.reason || "",
    scope: item.scope || "unknown"
  };
}

function renderMarkdown(plan) {
  const lines = [];

  lines.push("# QA ALIGN Engineer Remediation Plan");
  lines.push("");
  lines.push("> Internal engineering artifact. Do not send this file as the client-facing advisory report.");
  lines.push("");
  lines.push("## System Summary");
  lines.push("");
  lines.push(`- Framework: ${plan.summary.framework}`);
  lines.push(`- Trust Level: ${plan.summary.trustLevel}`);
  lines.push(`- Release Decision: ${plan.summary.releaseDecision}`);
  lines.push(`- Recommended Start Sprint: ${plan.summary.recommendedStartSprint}`);
  lines.push(`- Recommended Route: ${plan.summary.recommendedSequence.join(" → ") || "not available"}`);
  lines.push(`- Estimated Good Fix: $${plan.summary.estimatedGoodFix}`);
  lines.push("");
  lines.push("## Engineer Execution Order");
  lines.push("");
  plan.executionOrder.forEach((item, index) => {
    lines.push(`${index + 1}. **${item.id}** — ${item.reason}`);
  });
  lines.push("");

  for (const item of plan.findings) {
    lines.push(`## ${item.id}`);
    lines.push("");
    lines.push(`**Severity:** ${item.severity}`);
    lines.push(`**Impact:** ${item.impact}`);
    lines.push("");
    lines.push("### Pattern Detected");
    lines.push(item.pattern);
    lines.push("");
    lines.push("### Evidence");
    if (item.evidence.length) {
      item.evidence.forEach((e) => lines.push(`- ${e}`));
    } else {
      lines.push("- No evidence text provided in advisory artifact.");
    }
    lines.push("");
    lines.push("### Engineering Intent");
    lines.push(item.intent);
    lines.push("");
    lines.push("### Likely Files To Inspect");
    item.likelyFiles.forEach((f) => lines.push(`- ${f}`));
    lines.push("");
    lines.push("### Fix Steps");
    item.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push("");
    lines.push("### Do Not");
    item.doNot.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
    lines.push("### Verification");
    item.verify.forEach((v) => lines.push(`- ${v}`));
    lines.push("");
    lines.push("### Expected Impact");
    lines.push(item.expectedImpact);
    lines.push("");
  }

  return lines.join("\n");
}

function executionPriority(finding) {
  const id = finding.id || "";
  if (id.includes("debug-artifact")) return 10;
  if (id.includes("assertion-correctness")) return 20;
  if (id.includes("shared-browser-session")) return 30;
  if (id.includes("parallel")) return 40;
  if (id.includes("credential") || id.includes("environment")) return 50;
  if (id.includes("dependency")) return 60;
  if (id.includes("page-object")) return 70;
  return 90;
}

const report = readJson(reportPath);
const assessment = readJson(assessmentPath);
const routing = fs.existsSync(routingPath) ? readJson(routingPath) : {};

const rawFindings = safeArray(report.issueBreakdown).map(normalizeFinding);

const findings = rawFindings.map((finding) => {
  const template = templates[finding.id] || fallbackTemplate(finding.id);
  const evidence = finding.detail
    ? finding.detail.split(";").map((x) => x.trim()).filter(Boolean)
    : [];

  return {
    ...finding,
    pattern: template.pattern,
    evidence,
    intent: template.intent,
    likelyFiles: template.likelyFiles,
    steps: template.steps,
    doNot: template.doNot,
    verify: template.verify,
    expectedImpact: template.expectedImpact,
    priority: executionPriority(finding)
  };
}).sort((a, b) => a.priority - b.priority);

const executionOrder = findings.map((finding) => ({
  id: finding.id,
  reason:
    finding.priority <= 20 ? "Fix early because it affects diagnosability or signal correctness." :
    finding.priority <= 40 ? "Fix next because it affects release confidence and parallel stability." :
    finding.priority <= 60 ? "Fix after baseline stability because it affects environment/CI reproducibility." :
    "Fix after critical trust blockers are under control."
}));

const plan = {
  artifact: "fix-plan.engineer",
  generatedAt: new Date().toISOString(),
  internalOnly: true,
  summary: {
    framework: report.executiveSummary?.framework || assessment.framework || "unknown",
    trustLevel: report.executiveSummary?.trustLevel || assessment.trustLevel || "unknown",
    releaseDecision: report.releaseDecision || "UNKNOWN",
    recommendedStartSprint: report.executiveSummary?.recommendedStartSprint || routing.recommendedStartSprint || "unknown",
    recommendedSequence: safeArray(routing.recommendedSequence),
    estimatedGoodFix: report.estimatedCostToFix?.good || null
  },
  executionOrder,
  findings
};

fs.mkdirSync("out", { recursive: true });

fs.writeFileSync("out/fix-plan.engineer.json", JSON.stringify(plan, null, 2) + "\n");
fs.writeFileSync("out/fix-plan.engineer.md", renderMarkdown(plan) + "\n");

console.log("Wrote out/fix-plan.engineer.json");
console.log("Wrote out/fix-plan.engineer.md");

import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = input.frameworkAssessment;
const r = input.sprintRouting;
const releaseDecision = deriveReleaseDecision(a);
const cost = buildCost(a.topFindings || []);

const output = {
  agent: "advisory_report",
  title: "QA ALIGN Assessment Report",
  executiveSummary: {
    framework: a.framework,
    trustLevel: a.trustLevel,
    pathRecommendation: a.pathRecommendation,
    recommendedStartSprint: r.recommendedStartSprint,
    summary: `This ${a.framework} system is currently ${a.trustLevel} trust. The recommended starting point is Sprint ${r.recommendedStartSprint}, with modernization following the ${a.pathRecommendation} path.`
  },
  releaseDecision,
  issueBreakdown: (a.topFindings || []).map(f => ({
    title: f.title,
    severity: f.severity,
    impact: f.releaseImpact,
    detail: f.reason
  })),
  estimatedCostToFix: cost.tiers,
  costBreakdown: cost.items,
  topRisks: a.dominantRisks.map((x) => `${x} risk`),
  technicalFindings: (a.topFindings || []).map(
    (f) => `${f.title}: ${f.reason}`
  ),
  roadmap: (r.recommendedSequence || []).map(
    (s) => `Proceed through Sprint ${s} as part of the recommended correction path.`
  ),
  nextSteps: buildNextSteps(a.topFindings || [], releaseDecision)
};

function deriveReleaseDecision(a) {
  const explicit = a.releaseSignals?.releaseGate;

  if (explicit && explicit !== "UNKNOWN") {
    return explicit;
  }

  const findings = a.topFindings || [];

  const hasFrameworkWideHigh = findings.some(f =>
    f.severity === "high" && f.scope === "systemic"
  );

  const hasBlockingImpact = findings.some(f =>
    f.releaseImpact === "blocks_trust"
  );

  const hasHighDiagnosticGap = findings.some(f =>
    f.severity === "high" && f.releaseImpact === "slows_diagnosis"
  );

  if (a.trustLevel === "low" && (hasFrameworkWideHigh || hasBlockingImpact || hasHighDiagnosticGap)) {
    return "BLOCK";
  }

  if (a.trustLevel === "low") {
    return "WARN";
  }

  if (a.trustLevel === "medium") {
    return "WARN";
  }

  return "GO";
}

function buildNextSteps(findings, releaseDecision) {
  const steps = [];
  
  // 1. Handle release blocking issues first
  const blocking = findings.filter(f =>
    f.releaseImpact === "blocks_trust" &&
    f.title.startsWith("runtime-")
  );
  
  
  
  if (blocking.length) {
    steps.push("Stabilize release-blocking failures:");
    blocking.forEach(f => {
      steps.push(`- Investigate and fix: ${f.title}`);
    });
    steps.push("Release decision should remain BLOCK until these are resolved.");
  }
  
  // 2. State issues
  const stateIssues = findings.filter(f =>
    f.title.includes("state") || f.title.includes("lifecycle")
  );
  
  if (stateIssues.length) {
    steps.push("Strengthen deterministic state control:");
    steps.push("- Ensure fresh state per test (no shared auth/session bleed)");
  }
  

  // 3. Locator issues
  const locatorIssues = findings.filter(f =>
    f.title.includes("locator")
  );
  
  if (locatorIssues.length) {
    steps.push("Reduce locator instability:");
    steps.push("- Replace brittle selectors with role/label-based locators");
  }
  
  
  // 4. Selenium-specific remediation
  const seleniumSessionIssues = findings.filter(f =>
    f.title.includes("selenium-shared-browser-session")
  );

  if (seleniumSessionIssues.length) {
    steps.push("Stabilize Selenium browser session lifecycle:");
    steps.push("- Create a fresh WebDriver/session boundary per test or isolated worker");
    steps.push("- Avoid shared driver state across auth, unauth, and parallel flows");
  }

  const seleniumParallelIssues = findings.filter(f =>
    f.title.includes("selenium-parallel-driver-lifecycle")
  );

  if (seleniumParallelIssues.length) {
    steps.push("Harden Selenium parallel execution:");
    steps.push("- Validate ThreadLocal WebDriver lifecycle setup and teardown");
    steps.push("- Ensure parallel data providers do not share mutable test data");
  }

  const seleniumDebugIssues = findings.filter(f =>
    f.title.includes("selenium-debug-artifact-gap")
  );

  if (seleniumDebugIssues.length) {
    steps.push("Add Selenium failure artifacts:");
    steps.push("- Capture screenshot, page source, and browser logs on failure");
    steps.push("- Attach artifacts to CI output so failures can be diagnosed without reruns");
  }

  const seleniumStructureIssues = findings.filter(f =>
    f.title.includes("selenium-page-object-responsibility-mixing")
  );

  if (seleniumStructureIssues.length) {
    steps.push("Separate Page Object responsibilities:");
    steps.push("- Move assertions out of Page Objects and into test/spec layers");
    steps.push("- Keep Page Objects focused on navigation, locators, and user actions");
  }

  // 5. Always include re-run
  steps.push("Re-run assessment after fixes to validate trust level improvement.");
  
  return steps;
}

function estimateHours(f) {
  const base =
  f.title.startsWith("runtime-") ? 6 :
  f.title.includes("state") ? 8 :
  f.title.includes("locator") ? 5 : 4;
  
  // crude occurrence proxy from detail text if present
  const m = (f.reason || "").match(/\((\d+)\)/);
  const occ = m ? Number(m[1]) : 1;
  
  // diminishing returns for repetition
  const factor = Math.min(1 + Math.log2(occ), 3);
  return Math.round(base * factor);
}

function buildCost(findings) {
  const items = (findings || []).map(f => {
    const hours = estimateHours(f);
    const rate = 150; // keep constant for now
    return {
      title: f.title,
      hours,
      cost: hours * rate
    };
  });
  
  const total = items.reduce((s, i) => s + i.cost, 0);
  
  return {
    items,
    total,
    tiers: {
      baseline: Math.round(total * 0.8),
      good: total,
      great: Math.round(total * 1.8)
    }
  };
}

console.log(JSON.stringify(output, null, 2));

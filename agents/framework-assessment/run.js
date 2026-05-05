import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const rawFindings = input.antiPatterns || input.risks || [];

const antiPatterns = rawFindings.map((item) => ({
  title: item.title || item.id || "Unknown Issue",
  severity: item.severity || "high",
  scope:
    item.scope === "framework_wide"
      ? "systemic"
      : item.scope === "suite_partial"
        ? "recurring"
        : item.scope || "systemic",
  layer: item.layer || "runtime",
  releaseImpact:
    item.impact === "release_blocking"
      ? "blocks_trust"
      : item.impact === "release_confidence"
        ? "weakens_release_confidence"
        : item.releaseImpact || "blocks_trust",
  family: item.impact || item.id || "runtime",
  notes: Array.isArray(item.evidence)
    ? item.evidence.join("; ")
    : item.evidence || item.notes || item.impact || "Structured risk finding."
}));

const familyScores = {};
let score = 100;

for (const item of antiPatterns) {
  let penalty = 0;

  if (item.severity === "high" && item.scope === "systemic") penalty += 20;
  else if (item.severity === "high" && item.scope === "recurring") penalty += 12;
  else if (item.severity === "medium" && item.scope === "systemic") penalty += 10;
  else if (item.severity === "low" && item.scope === "systemic") penalty += 4;

  if (item.releaseImpact === "blocks_trust") penalty += 10;
  if (item.releaseImpact === "causes_false_green_risk") penalty += 12;
  if (item.releaseImpact === "slows_diagnosis") penalty += 8;
  if (item.releaseImpact === "weakens_release_confidence") penalty += 8;
  if (item.releaseImpact === "scalability_risk_only") penalty += 3;

  score -= penalty;
  familyScores[item.family] = (familyScores[item.family] || 0) + penalty;
}

score = Math.max(0, Math.min(100, score));

const trustLevel = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

const dominantRisks = Object.entries(familyScores)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([family]) => family);

const pathRecommendation =
  trustLevel === "low" ? "no_ai" :
  trustLevel === "medium" ? "some_ai" :
  "ai_forward";

const framework = input.framework || input.source?.framework || "unknown";

const output = {
  agent: "framework_assessment",
  framework,
  trustScore: score,
  trustLevel,
  summary: `${framework} system assessed at ${trustLevel} trust based on current risk concentration and release-signal evidence.`,
  dominantRisks,
  topFindings: antiPatterns.slice(0, 12).map((item) => ({
    title: item.title,
    severity: item.severity,
    scope: item.scope,
    layer: item.layer,
    releaseImpact: item.releaseImpact,
    reason: item.notes
  })),
  releaseSignals: input.releaseSignals || {},
  pathRecommendation
};

console.log(JSON.stringify(output, null, 2));

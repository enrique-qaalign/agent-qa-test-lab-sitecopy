import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const a = input.frameworkAssessment;
const r = input.sprintRouting;

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
  topRisks: a.dominantRisks.map((x) => `${x} risk`),
  technicalFindings: (a.topFindings || []).map(
    (f) => `${f.title}: ${f.reason}`
  ),
  roadmap: (r.recommendedSequence || []).map(
    (s) => `Proceed through Sprint ${s} as part of the recommended correction path.`
  ),
  nextSteps: [
    "Run a technical signal review against the current framework implementation.",
    "Validate trust level with real anti-pattern evidence.",
    `Begin with Sprint ${r.recommendedStartSprint} before introducing higher-order acceleration layers.`
  ]
};

console.log(JSON.stringify(output, null, 2));

export function route(assessment) {
  const risks = new Set(assessment.dominantRisks || []);
  const trust = assessment.trustLevel;

  const reasoning = [];
  const sequence = [];
  const doNotStartWith = [];

  if (trust === "low") {
    if (risks.has("DIAGNOSABILITY")) {
      sequence.push("3");
      reasoning.push("Diagnosability weakness requires artifact-first correction.");
    }
    if (risks.has("LOCATOR") || risks.has("TIMING")) {
      sequence.push("4");
      reasoning.push("Locator or timing instability should be classified before optimization.");
    }
    if (risks.has("STATE") || risks.has("DATA") || risks.has("AUTH")) {
      sequence.push("5");
      reasoning.push("State and data ownership must be stabilized before trust can improve.");
    }
    sequence.push("6");
    doNotStartWith.push("16", "17", "ai_forward");
  } else if (trust === "medium") {
    if (risks.has("STATE") || risks.has("DATA") || risks.has("AUTH")) sequence.push("5");
    sequence.push("6");
    if (risks.has("LOCATOR")) sequence.push("16");
    doNotStartWith.push("ai_forward");
  } else {
    sequence.push("6");
    if (risks.has("LOCATOR")) sequence.push("16");
    sequence.push("17");
  }

  const uniq = [...new Set(sequence)];
  return {
    agent: "sprint_router",
    trustLevel: trust,
    recommendedStartSprint: uniq[0],
    recommendedSequence: uniq,
    pathRecommendation: assessment.pathRecommendation,
    reasoning,
    doNotStartWith
  };
}

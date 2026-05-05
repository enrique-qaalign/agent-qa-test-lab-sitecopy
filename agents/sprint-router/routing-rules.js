export function route(assessment) {
  const risks = new Set(assessment.dominantRisks || []);
  const findings = assessment.topFindings || [];
  const trust = assessment.trustLevel;

  const reasoning = [];
  const sequence = [];
  const doNotStartWith = [];

  function addSprint(sprint, reason) {
    if (!sequence.includes(sprint)) sequence.push(sprint);
    if (reason && !reasoning.includes(reason)) reasoning.push(reason);
  }

  function hasFinding(match) {
    return findings.some((f) =>
      String(f.title || "").includes(match) ||
      String(f.releaseImpact || "").includes(match) ||
      String(f.reason || "").includes(match)
    );
  }

  const hasDiagnosabilityRisk =
    risks.has("DIAGNOSABILITY") ||
    risks.has("slows_diagnosis") ||
    hasFinding("selenium-debug-artifact-gap") ||
    hasFinding("slows_diagnosis");

  const hasLocatorOrTimingRisk =
    risks.has("LOCATOR") ||
    risks.has("TIMING") ||
    risks.has("maintainability_and_flake_risk") ||
    hasFinding("locator") ||
    hasFinding("wait") ||
    hasFinding("timing");

  const hasStateOrSessionRisk =
    risks.has("STATE") ||
    risks.has("DATA") ||
    risks.has("AUTH") ||
    risks.has("release_confidence") ||
    hasFinding("state") ||
    hasFinding("session") ||
    hasFinding("driver-lifecycle") ||
    hasFinding("shared-browser-session");

  const hasStructureRisk =
    risks.has("STRUCTURE") ||
    hasFinding("page-object-responsibility-mixing") ||
    hasFinding("structure");

  if (trust === "low") {
    if (hasDiagnosabilityRisk) {
      addSprint("3", "Diagnosability weakness requires artifact-first correction.");
    }

    if (hasStateOrSessionRisk) {
      addSprint("5", "State, session, and driver lifecycle ownership must be stabilized before trust can improve.");
    }

    if (hasLocatorOrTimingRisk || hasStructureRisk) {
      addSprint("6", "Framework structure, timing, and maintainability risks should be corrected before acceleration.");
    }

    if (sequence.length === 0) {
      addSprint("6", "Low trust framework requires baseline stabilization.");
    }

    doNotStartWith.push("16", "17", "ai_forward");
  } else if (trust === "medium") {
    if (hasDiagnosabilityRisk) {
      addSprint("3", "Evidence quality should be strengthened before scaling automation.");
    }

    if (hasStateOrSessionRisk) {
      addSprint("5", "State/session ownership should be stabilized before higher-order optimization.");
    }

    addSprint("6", "Framework reliability should be strengthened before acceleration.");

    if (risks.has("LOCATOR") || hasFinding("locator")) {
      addSprint("16", "Locator governance can be improved after baseline stability.");
    }

    doNotStartWith.push("ai_forward");
  } else {
    addSprint("6", "High-trust systems can proceed to framework improvement.");
    if (risks.has("LOCATOR") || hasFinding("locator")) {
      addSprint("16", "Locator validation can improve long-term maintainability.");
    }
    addSprint("17", "Release gate automation is appropriate after trust is established.");
  }

  return {
    agent: "sprint_router",
    trustLevel: trust,
    recommendedStartSprint: sequence[0],
    recommendedSequence: sequence,
    pathRecommendation: assessment.pathRecommendation,
    reasoning,
    doNotStartWith
  };
}

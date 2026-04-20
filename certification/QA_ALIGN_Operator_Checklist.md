# QA ALIGN Certified Operator Checklist

## Purpose

The Operator level proves that the engineer can run the QA ALIGN system, interpret its outputs, and handle generated artifacts without confusing drafts with trusted signal.

---

## Competencies

### System Understanding
- Understands the difference between generic automation and the QA ALIGN system
- Can explain deterministic environment discipline
- Can explain why runner and SUT separation matters
- Can explain why hidden configuration and localhost shortcuts are disallowed
- Can explain low, medium, and high trust
- Can explain no_ai, some_ai, and ai_forward paths
- Can explain why generated output is not automatically trusted release signal

### Pipeline Operation
- Can run workbook intake
- Can run framework assessment
- Can run sprint routing
- Can run advisory report generation
- Can render HTML report
- Can export PDF report
- Can run the bounded test-generation pipeline
- Can find all major outputs in `out/` and `test-results/`

### Artifact Literacy
- Can read `framework-assessment.json`
- Can read `sprint-routing.json`
- Can read `advisory-report.json`
- Can read `element-type-map.json`
- Can read `action-method-candidates.json`
- Can read `composite-action-candidates.json`
- Can read `test-skeleton-candidates.json`
- Can inspect generated page objects and generated specs

### Process Discipline
- Does not promote draft outputs directly into trusted suites
- Flags low-confidence results for review
- Knows when review is mandatory
- Understands Node vs Python tooling in the repo
- Uses `.venv` only for Python-dependent steps

---

## Operator Practical Exam

### Practical 1 — Run the Assessment Pipeline
Given:
- workbook file
- framework target

Task:
- generate workbook assessment input
- run framework assessment
- run sprint routing
- run advisory report
- render HTML report
- export PDF report

Expected outputs:
- `out/workbook-assessment-input.json`
- `out/framework-assessment.json`
- `out/sprint-routing.json`
- `out/advisory-report.json`
- `out/advisory-report.html`
- `out/advisory-report.pdf`

Pass criteria:
- all outputs generated successfully
- candidate can explain trust level, path, and start sprint

---

### Practical 2 — Interpret the Advisory Report
Given:
- completed advisory report

Task:
Explain:
- trust level
- path recommendation
- recommended start sprint
- top anti-pattern families
- why the system was routed this way

Pass criteria:
- explanation matches report output
- explanation is technically correct
- no overclaiming

---

### Practical 3 — Run the Test-Generation Pipeline
Given:
- existing composite action candidates
- existing action method candidates

Task:
- run test skeleton generation
- run assertion candidate generation
- run page-object draft generation
- run spec draft generation

Expected outputs:
- `test-results/test-generation/test-skeleton-candidates.json`
- `test-results/test-generation/assertion-candidates.json`
- `test-results/test-generation/page-object-draft.json`
- `test-results/test-generation/spec-drafts.json`
- generated page object file
- generated spec files

Pass criteria:
- all files generated correctly
- candidate can identify which test needs review

---

### Practical 4 — Generated Artifact Review
Given:
- generated page object
- generated spec drafts

Task:
Classify:
- what is acceptable as a draft
- what needs human correction
- what cannot be trusted yet

Pass criteria:
- candidate does not confuse draft assets with production-ready assets
- candidate identifies confidence/review boundaries correctly

---

## Scoring Rubric

### Technical execution
35 percent

### Output interpretation
30 percent

### Process discipline
20 percent

### Communication clarity
15 percent

---

## Pass Rule

- Minimum 80 percent overall
- Must pass Practical 1
- Must not fail process discipline
- Must show clear understanding of trust boundaries

---

## Certification Decision

### Pass
Candidate may operate the QA ALIGN system as an Operator.

### Conditional Pass
Candidate may operate under supervision until one failed practical is corrected.

### Fail
Candidate requires retraining before reassessment.

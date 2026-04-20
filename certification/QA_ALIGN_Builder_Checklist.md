# QA ALIGN Certified Builder Checklist

## Purpose

The Builder level proves that the engineer can build, review, improve, and correct automation inside the QA ALIGN system.

This level focuses on implementation quality, artifact review, and controlled AI output correction.

---

## Competencies

### Framework Building
- Can create and refactor action methods
- Can review and improve generated page-object drafts
- Can review and improve generated spec drafts
- Can improve naming and structure in generated code
- Can distinguish primitive methods from composite actions
- Can preserve determinism while improving readability

### Locator and Action Intelligence
- Understands locator priority model
- Can explain accessibility-first locator value
- Can review typed elements and semantic intent
- Can reject weak composite generation
- Can improve action-method synthesis rules
- Can preserve confidence-based generation boundaries

### Test Quality
- Can strengthen weak assertions
- Can identify shallow or generic assertions
- Can separate positive-path confidence from negative-path caution
- Can identify where additional evidence is needed
- Can improve generated tests without overreaching

### Stability and Diagnosability
- Can identify wait and synchronization problems
- Can identify state leakage
- Can identify auth leakage
- Can identify diagnosability weaknesses
- Can explain Sprint 3 vs 4 vs 5 correction logic
- Can improve artifact retention and reviewability

### Controlled AI Usage
- Can explain why AI may draft but not auto-trust
- Can explain where human review is required
- Can explain why known action methods are safer than freestyle generation

---

## Builder Practical Exam

### Practical 1 — Correct a Generated Page Object
Given:
- generated page object draft

Task:
- improve property names
- improve method names if needed
- preserve deterministic behavior
- remove awkward or confusing structure

Pass criteria:
- code is cleaner
- code is still deterministic
- abstractions improve rather than degrade

---

### Practical 2 — Correct Generated Specs
Given:
- generated positive and negative auth specs

Task:
- replace placeholder comments with realistic page-object usage
- strengthen assertions where appropriate
- preserve review requirement for lower-confidence draft
- decide which spec is safer to promote first

Pass criteria:
- improved spec quality
- correct judgment about promotion readiness
- no unsafe over-promotion

---

### Practical 3 — Anti-Pattern Remediation
Given:
- one timing anti-pattern
- one state/auth leakage anti-pattern
- one diagnosability anti-pattern

Task:
- explain root cause
- propose correction
- map each issue to the right sprint correction path

Pass criteria:
- reasoning is sound
- fixes are aligned with QA ALIGN
- sprint mapping is credible

---

### Practical 4 — Action Synthesis Review
Given:
- element type map
- action method candidates
- composite action candidates

Task:
- approve or reject composites
- justify confidence decisions
- identify one example of overreach

Pass criteria:
- candidate shows sound judgment
- weak composites are not promoted
- rationale is clear and technically grounded

---

## Scoring Rubric

### Code correction quality
35 percent

### Judgment on generated artifacts
25 percent

### Anti-pattern remediation reasoning
25 percent

### Communication clarity
15 percent

---

## Pass Rule

- Minimum 85 percent overall
- Must pass Practical 2 and Practical 3
- Must not approve unsafe generated output
- Must demonstrate builder-level judgment

---

## Certification Decision

### Pass
Candidate may build and improve artifacts within the QA ALIGN system.

### Conditional Pass
Candidate may build under review until failed areas are corrected.

### Fail
Candidate requires additional training and reassessment.

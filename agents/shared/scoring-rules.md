# QA ALIGN v1 Scoring Rules

Start trust score at 100.

Subtract:
- high severity + systemic: -20
- high severity + recurring: -12
- medium severity + systemic: -10
- low severity + systemic: -4
- blocks_trust: -10
- causes_false_green_risk: -12
- slows_diagnosis: -8
- weakens_release_confidence: -8
- scalability_risk_only: -3

Additional penalties:
- diagnosability weakness present: -18
- rerun dependence present: -15
- shared state/auth leakage present: -15
- brittle locator systemic risk present: -12
- over-mocking / false realism present: -10

Trust band mapping:
- 70 and above = high
- 45 to 69 = medium
- below 45 = low

Dominant risks are the top weighted anti-pattern families by aggregate score.

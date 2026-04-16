# QA ALIGN next-step package

This package includes:

- `build-assessment-input-from-workbook.js`
  - Reads the workbook `Matrix` sheet and converts rows for one framework into a framework-assessment input JSON.

- `render-advisory-report-html.js`
  - Converts `out/advisory-report.json` into a polished HTML report.

- `export-advisory-report-pdf.py`
  - Converts `out/advisory-report.json` into a PDF using a lightweight document renderer.

- `framework-remediation-guidance.json`
  - Framework-specific remediation starters by dominant risk family.

- `site-runbook-integration.md`
  - Suggestions for connecting outputs back into the site and runbooks.

## Important note
Your workbook currently uses `Layer` values such as `Auth`, but the original agent enums only included:
- ui
- api
- ci
- data
- release

You should expand the shared layer enum to include:
- auth

Or normalize `Auth` rows into another layer intentionally.

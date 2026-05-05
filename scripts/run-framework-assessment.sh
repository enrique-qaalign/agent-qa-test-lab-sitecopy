#!/usr/bin/env bash
set -euo pipefail

INPUT="out/framework-assessment-input.generated.json"
OUT_DIR="out"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT="$2"
      shift 2
      ;;
    --outDir)
      OUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: bash scripts/run-framework-assessment.sh --input out/framework-assessment-input.generated.json"
      exit 0
      ;;
    *)
      echo "[BLOCK] Unknown argument: $1"
      exit 1
      ;;
  esac
done

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "[BLOCK] Required file missing: $file"
    exit 1
  fi
}

require_json() {
  local file="$1"
  require_file "$file"

  if command -v jq >/dev/null 2>&1; then
    jq empty "$file" >/dev/null
  else
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$file"
  fi
}

echo ""
echo "QA ALIGN Framework Assessment"
echo "========================================"
echo "Input: $INPUT"

require_json "$INPUT"

mkdir -p "$OUT_DIR"

echo ""
echo "[1/4] Running assessment agents..."
node agents/run-assessment-agents.js "$INPUT"

echo ""
echo "[2/4] Validating report artifacts..."
require_json "$OUT_DIR/framework-assessment.json"
require_json "$OUT_DIR/sprint-routing.json"
require_json "$OUT_DIR/advisory-report.json"

echo ""
echo "[3/4] Rendering HTML report..."
node agents/render-advisory-report-html.js \
  "$OUT_DIR/advisory-report.json" \
  "$OUT_DIR/advisory-report.html"

require_file "$OUT_DIR/advisory-report.html"

echo ""
echo "[4/4] Summary"
echo "========================================"

node - <<'NODE'
const fs = require("fs");
const report = JSON.parse(fs.readFileSync("out/advisory-report.json", "utf8"));

console.log(`Framework: ${report.executiveSummary.framework}`);
console.log(`Trust Level: ${report.executiveSummary.trustLevel}`);
console.log(`Release Decision: ${report.releaseDecision}`);
console.log("Estimated Cost to Fix:");
console.log(`- Baseline: $${report.estimatedCostToFix.baseline}`);
console.log(`- Good: $${report.estimatedCostToFix.good}`);
console.log(`- Great: $${report.estimatedCostToFix.great}`);
console.log("");
console.log("Artifacts:");
console.log("- out/framework-assessment.json");
console.log("- out/sprint-routing.json");
console.log("- out/advisory-report.json");
console.log("- out/advisory-report.html");
console.log("");
console.log("Open report:");
console.log("open out/advisory-report.html");
NODE

echo ""
echo "Assessment complete."

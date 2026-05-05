#!/usr/bin/env bash
set -euo pipefail

TARGET_REPO="${1:-}"

ENGINE_REPO="${ENGINE_REPO:-/Users/enriquehenderson/playwright-automation-framework}"
SITE_REPO="${SITE_REPO:-/Users/enriquehenderson/lab-site/qa-test-lab-site}"

if [[ -z "$TARGET_REPO" ]]; then
  echo "Usage:"
  echo "  bash scripts/run-selenium-assessment.sh /path/to/selenium/repo"
  exit 1
fi

if [[ ! -d "$TARGET_REPO" ]]; then
  echo "ERROR: Target repo does not exist: $TARGET_REPO"
  exit 1
fi

if [[ ! -f "$ENGINE_REPO/scripts/assess_run_all_validation_commands.sh" ]]; then
  echo "ERROR: Runner validation script not found:"
  echo "$ENGINE_REPO/scripts/assess_run_all_validation_commands.sh"
  exit 1
fi

if [[ ! -f "$ENGINE_REPO/scripts/assess-parse-validation-log.js" ]]; then
  echo "ERROR: Runner parser not found:"
  echo "$ENGINE_REPO/scripts/assess-parse-validation-log.js"
  exit 1
fi

if [[ ! -f "$SITE_REPO/scripts/run-framework-assessment.sh" ]]; then
  echo "ERROR: Brain assessment runner not found:"
  echo "$SITE_REPO/scripts/run-framework-assessment.sh"
  exit 1
fi

echo ""
echo "QA ALIGN Selenium Assessment"
echo "========================================"
echo "Target repo: $TARGET_REPO"
echo "Engine repo: $ENGINE_REPO"
echo "Site repo:   $SITE_REPO"
echo ""

echo "[1/5] Running validation scan..."
cd "$TARGET_REPO"
bash "$ENGINE_REPO/scripts/assess_run_all_validation_commands.sh"

LATEST_LOG="$(ls -t "$TARGET_REPO"/validation-output/run_all_validation_commands_*.log | head -1)"

if [[ -z "$LATEST_LOG" || ! -f "$LATEST_LOG" ]]; then
  echo "ERROR: Could not locate latest validation log."
  exit 1
fi

echo ""
echo "Latest log: $LATEST_LOG"

echo ""
echo "[2/5] Parsing Selenium assessment signals..."
cd "$ENGINE_REPO"

mkdir -p out

node scripts/assess-parse-validation-log.js \
  --framework selenium \
  --repo "$TARGET_REPO" \
  --log "$LATEST_LOG" \
  --out out/framework-assessment-input.selenium.json

if [[ ! -f "$ENGINE_REPO/out/framework-assessment-input.selenium.json" ]]; then
  echo "ERROR: Parser did not produce Selenium assessment input."
  exit 1
fi

echo ""
echo "[3/5] Copying assessment input to Brain repo..."
mkdir -p "$SITE_REPO/out"

cp "$ENGINE_REPO/out/framework-assessment-input.selenium.json" \
  "$SITE_REPO/out/framework-assessment-input.generated.json"

echo ""
echo "[4/5] Running QA ALIGN advisory report pipeline..."
cd "$SITE_REPO"

bash scripts/run-framework-assessment.sh \
  --input out/framework-assessment-input.generated.json

echo ""
echo "[5/5] Opening advisory report..."
open out/advisory-report.html

echo ""
echo "Selenium assessment complete."
echo "Report: $SITE_REPO/out/advisory-report.html"

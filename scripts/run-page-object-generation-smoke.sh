#!/usr/bin/env bash
set -euo pipefail

echo "== QA ALIGN page-object generation smoke =="

LOCATOR_MAP="test-results/locator-intelligence/locator-map.normalized.json"
ELEMENT_MAP="test-results/locator-intelligence/element-type-map.json"
ACTION_METHODS="test-results/locator-intelligence/action-method-candidates.json"
COMPOSITES="test-results/locator-intelligence/composite-action-candidates.json"
PO_JSON="test-results/test-generation/page-object-draft.json"
PO_TS="test-results/test-generation/generated-page-objects/RequestAccessQAALIGNPage.ts"

if [ ! -f "$LOCATOR_MAP" ]; then
  echo "BLOCK: Missing normalized locator map: $LOCATOR_MAP"
  exit 1
fi

node agents/element-typing/run.js \
  "$LOCATOR_MAP" \
  "$ELEMENT_MAP"

node agents/action-method-synthesis/run.js \
  "$ELEMENT_MAP" \
  "$ACTION_METHODS"

node agents/composite-action-synthesis/run.js \
  "$ACTION_METHODS" \
  "$COMPOSITES"

node agents/page-object-draft-generation/run.js \
  "$ACTION_METHODS" \
  "$COMPOSITES" \
  "$PO_JSON" \
  "$ELEMENT_MAP"

if [ ! -f "$PO_TS" ]; then
  echo "BLOCK: Missing generated page object: $PO_TS"
  exit 1
fi

echo "== Generated Page Object =="
sed -n '1,220p' "$PO_TS"

echo "== Contract checks =="

grep -q "Submit Request" "$PO_TS" || {
  echo "BLOCK: Expected Submit Request locator not found"
  exit 1
}

grep -q "company" "$PO_TS" || {
  echo "BLOCK: Expected company locator not found"
  exit 1
}

grep -q "email" "$PO_TS" || {
  echo "BLOCK: Expected email locator not found"
  exit 1
}

grep -q "name" "$PO_TS" || {
  echo "BLOCK: Expected name locator not found"
  exit 1
}

if grep -q "page.locator('TODO')" "$PO_TS"; then
  echo "BLOCK: Generated page object still contains TODO locator"
  exit 1
fi

if grep -q "Sign in" "$PO_TS"; then
  echo "BLOCK: Generated page object still contains stale Sign in auth locator"
  exit 1
fi

echo "GO: Page object generation smoke passed"

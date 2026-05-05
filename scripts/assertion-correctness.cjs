#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repo = process.argv[2];
if (!repo) {
  console.error('Usage: node scripts/assertion-correctness.cjs /path/to/repo');
  process.exit(1);
}

const TARGET_DIRS = ['src/test/java', 'src/main/java'];
const results = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out = out.concat(walk(p));
    else if (p.endsWith('.java')) out.push(p);
  }
  return out;
}

// Very conservative pattern:
// return <expr> == <expr>;
const pattern = /return\s+(.+?)\s*==\s*(.+?);/g;

for (const d of TARGET_DIRS) {
  const base = path.join(repo, d);
  const files = walk(base);

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    content = content.replace(pattern, (m, left, right) => {
      // Heuristic: only change if looks string-ish
      const l = left.toLowerCase();
      const r = right.toLowerCase();

      const looksStringy =
        l.includes('gettitle') ||
        l.includes('gettext') ||
        l.includes('title') ||
        l.includes('text') ||
        r.includes('title') ||
        r.includes('text') ||
        r.includes('"');

      if (!looksStringy) return m;

      const replacement = `return java.util.Objects.equals(${left.trim()}, ${right.trim()});`;
      results.push({ file, before: m.trim(), after: replacement.trim() });
      changed = true;
      return replacement;
    });

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
    }
  }
}

// Write report
const outDir = path.join(process.cwd(), 'out');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'assertion-correctness-fixes.json'),
  JSON.stringify(results, null, 2)
);

const md = [
  '# Assertion Correctness Fixes',
  '',
  ...results.map(r => `## ${r.file}\n\n**Before**\n\`\`\`java\n${r.before}\n\`\`\`\n\n**After**\n\`\`\`java\n${r.after}\n\`\`\``)
].join('\n\n');

fs.writeFileSync(
  path.join(outDir, 'assertion-correctness-fixes.md'),
  md
);

console.log(`Applied ${results.length} fix(es).`);
console.log('Artifacts:');
console.log('- out/assertion-correctness-fixes.json');
console.log('- out/assertion-correctness-fixes.md');

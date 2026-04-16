import fs from "node:fs";
import path from "node:path";

/**
 * Usage:
 * node agents/render-advisory-report-html.js out/advisory-report.json out/advisory-report.html
 */

const inputPath = process.argv[2] || "out/advisory-report.json";
const outputPath = process.argv[3] || "out/advisory-report.html";

const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function list(items) {
  return items.map((x) => `<li>${x}</li>`).join("\n");
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${report.title}</title>
  <style>
    :root {
      --bg: #0b0e14;
      --panel: #121827;
      --panel2: #0f1522;
      --text: #e6e9ef;
      --muted: #aab2c5;
      --border: #24304d;
      --accent: #7aa2ff;
      --good: #44d19f;
      --warn: #ffce6b;
      --bad: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      background: var(--bg);
      color: var(--text);
    }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 24px 18px 48px; }
    .hero, .card {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(18,24,39,.98), rgba(11,14,20,.98));
      padding: 20px;
      margin-top: 16px;
    }
    .hero h1 { margin: 0 0 10px; font-size: 30px; }
    .muted { color: var(--muted); line-height: 1.65; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .stat {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      background: rgba(255,255,255,.02);
    }
    .eyebrow {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 6px;
    }
    h2 { margin: 0 0 10px; font-size: 18px; }
    ul { margin: 8px 0 0 18px; color: var(--muted); }
    li { margin: 6px 0; }
    .trust-low { color: var(--bad); }
    .trust-medium { color: var(--warn); }
    .trust-high { color: var(--good); }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } .hero h1 { font-size: 24px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">QA ALIGN</div>
      <h1>${report.title}</h1>
      <p class="muted">${report.executiveSummary.summary}</p>
      <div class="grid">
        <div class="stat">
          <div class="eyebrow">Framework</div>
          <div>${report.executiveSummary.framework}</div>
        </div>
        <div class="stat">
          <div class="eyebrow">Trust Level</div>
          <div class="trust-${report.executiveSummary.trustLevel}">${report.executiveSummary.trustLevel}</div>
        </div>
        <div class="stat">
          <div class="eyebrow">Path</div>
          <div>${report.executiveSummary.pathRecommendation}</div>
        </div>
        <div class="stat">
          <div class="eyebrow">Start Sprint</div>
          <div>${report.executiveSummary.recommendedStartSprint}</div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Top Risks</h2>
      <ul>${list(report.topRisks || [])}</ul>
    </section>

    <section class="card">
      <h2>Technical Findings</h2>
      <ul>${list(report.technicalFindings || [])}</ul>
    </section>

    <section class="card">
      <h2>Recommended Roadmap</h2>
      <ul>${list(report.roadmap || [])}</ul>
    </section>

    <section class="card">
      <h2>Immediate Next Steps</h2>
      <ul>${list(report.nextSteps || [])}</ul>
    </section>
  </div>
</body>
</html>`;

fs.writeFileSync(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);

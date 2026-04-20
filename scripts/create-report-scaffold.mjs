import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const rawClientName = await ask('Client name: ');
  const rawSlug = await ask('Slug (leave blank to auto-generate): ');
  const framework = await ask('Framework [Playwright]: ');
  const repoUrl = await ask('Repo URL: ');
  const siteUrl = await ask('Site URL: ');
  const trustLevel = await ask('Trust level [MEDIUM]: ');
  const pathValue = await ask('Path [no_ai]: ');
  const startSprint = await ask('Start sprint [4]: ');

  rl.close();

  const clientName = rawClientName.trim();
  if (!clientName) {
    console.error('Client name is required.');
    process.exit(1);
  }

  const slug = (rawSlug.trim() || slugify(clientName));
  const finalFramework = framework.trim() || 'Playwright';
  const finalTrustLevel = trustLevel.trim() || 'MEDIUM';
  const finalPath = pathValue.trim() || 'no_ai';
  const finalStartSprint = Number(startSprint.trim() || '4');

  const reportsDir = path.join(process.cwd(), 'src', 'data', 'reports');
  const outputPath = path.join(reportsDir, `${slug}.json`);

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  if (fs.existsSync(outputPath)) {
    console.error(`Report already exists: ${outputPath}`);
    process.exit(1);
  }

    const report = {
    slug,
    framework: finalFramework,
    client_name: clientName,
    repo_url: repoUrl.trim(),
    site_url: siteUrl.trim(),
    trust_level: finalTrustLevel,
    path: finalPath,
    start_sprint: finalStartSprint,
    summary: {
      total_issues: 0,
      high_impact: 0,
      medium_impact: 0,
      low_impact: 0
    },
    trust_explanation: {
      summary: 'Initial assessment intake has been received. Final release-confidence findings will be added after framework review.',
      drivers: [
        'Repository and framework review pending',
        'Issue classification pending',
        'Release-confidence assessment pending'
      ]
    },
    issues: [
      {
        type: 'Assessment in progress',
        occurrences: 0,
        impact: 'MEDIUM',
        detail: 'Framework review has been initiated and issue findings are being prepared.',
        risk: 'Release confidence should not be assumed until the completed assessment is delivered.'
      }
    ],
    cost_estimation: [
      {
        target: 'Stabilize',
        cost_usd: 0,
        note: 'Estimate will be added after issue classification is complete.'
      },
      {
        target: 'Reliable',
        cost_usd: 0,
        note: 'Estimate will be added after issue classification is complete.'
      },
      {
        target: 'Production-ready',
        cost_usd: 0,
        note: 'Estimate will be added after issue classification is complete.'
      }
    ],
    recommended_path: [
      'Complete framework review and issue classification',
      'Prioritize highest-impact reliability risks',
      'Define implementation path to release confidence'
    ],
    next_step_cta: 'Your detailed assessment is being prepared. Final recommendations will be delivered after review is complete.'
  };



  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Created report scaffold: ${outputPath}`);
  console.log(`Hosted path after build: /reports/${slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

const fs = require("node:fs");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/normalize-locator-map-for-typing.cjs <locator-map.json> <normalized-output.json>");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const candidates = [
  ...(Array.isArray(input.elements) ? input.elements : []),
  ...(Array.isArray(input.entries) ? input.entries : []),
  ...(Array.isArray(input.controls) ? input.controls : []),
  ...(Array.isArray(input.locators) ? input.locators : []),
];

const seen = new Set();

const elements = candidates
  .filter((item) => item && typeof item === "object")
  .map((item) => {
    const role = item.role || item.ariaRole || item.type || item.tag || "unknown";
    const name = item.name || item.label || item.text || item.placeholder || item.id || "";
    const locator =
      item.locator ||
      item.playwrightLocator ||
      (role && name ? `page.getByRole('${role}', { name: ${JSON.stringify(name)} })` : null);

    return {
      ...item,
      role,
      name,
      locator,
      source: item.source || "normalized-locator-map",
    };
  })
  .filter((item) => item.locator && item.name)
  .filter((item) => {
    const key = `${item.role}|${item.name}|${item.locator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

const output = {
  ...input,
  schemaVersion: input.schemaVersion || "1.0",
  normalizedAt: new Date().toISOString(),
  elements,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(`✅ Normalized ${elements.length} locator elements to ${outputPath}`);

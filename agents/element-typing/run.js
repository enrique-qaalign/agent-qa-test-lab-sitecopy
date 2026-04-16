import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || "test-results/locator-intelligence/element-type-map.json";

if (!inputPath) {
  console.error("Usage: node agents/element-typing/run.js <locator-map.json> [output.json]");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const elementsIn = input.elements || input.locators || [];

function inferIntent(el) {
  const name = [
    el.accessibleName,
    el.name,
    el.label,
    el.placeholder,
    el.nameAttr
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const role = (el.role || "").toLowerCase();
  const htmlType = (el.htmlType || el.type || "").toLowerCase();

  if ((htmlType === "password") || name.includes("password") || name.includes("pass_word")) {
    return "auth.password";
  }

  if (
    role.includes("textbox") &&
    (name.includes("username") ||
      name.includes("user name") ||
      name.includes("user_name") ||
      name.includes("email"))
  ) {
    return "auth.username";
  }

  if (
    role.includes("button") &&
    (name.includes("sign in") ||
      name.includes("log in") ||
      name.includes("login") ||
      name.includes("submit"))
  ) {
    return "auth.submit";
  }

  if (role.includes("textbox") && name.includes("search")) {
    return "search.query";
  }

  if (role.includes("button") && name.includes("save")) {
    return "entity.save";
  }

  if (role.includes("button") && name.includes("publish")) {
    return "entity.publish";
  }

  if (role.includes("button") && name.includes("delete")) {
    return "entity.delete";
  }

  if (role.includes("textbox")) return "field.input";
  if (role.includes("button")) return "action.click";
  if (role.includes("link")) return "nav.link";

  return "unknown";
}

function inferComponent(intent) {
  if (intent.startsWith("auth.")) return "login_form";
  if (intent.startsWith("search.")) return "search_form";
  return "generic_component";
}

function inferConfidence(intent) {
  if (intent.startsWith("auth.")) return 0.94;
  if (intent.startsWith("search.")) return 0.88;
  if (intent === "field.input" || intent === "action.click") return 0.78;
  return 0.5;
}

const out = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  page: {
    url: input.page?.url || input.url || "",
    title: input.page?.title || input.title || ""
  },
  elements: elementsIn.map((el, idx) => {
    const intent = inferIntent(el);
    return {
      elementId: el.elementId || `element.${idx + 1}`,
      locator: el.locator || {
        strategy: el.strategy || "unknown",
        value: el.value || el.name || ""
      },
      role: el.role || "unknown",
      htmlType: el.htmlType || el.type || "",
      accessibleName: el.accessibleName || el.name || el.label || "",
      placeholder: el.placeholder || "",
      nameAttr: el.nameAttr || el.name || "",
      intent,
      component: inferComponent(intent),
      confidence: inferConfidence(intent)
    };
  })
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Wrote ${outputPath}`);

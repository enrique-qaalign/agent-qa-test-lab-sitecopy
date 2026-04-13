// src/data/sprints.js
export const sprints = [
    {
      id: "0",
      phase: "discover",
      searchTitle: "How Do I Set Up a Reliable Test Environment from Scratch?",
      systemTitle: "Establish a Deterministic Baseline Environment",
      bullets: [
        "Environment rebuilds with identical results",
        "Configuration is versioned and reproducible",
        "Dependencies are explicitly defined",
        "Clean rollback is always available"
      ],
      image: "/images/sprints/sprint-0.png",
      runbookPreview: "/runbooks/0/",
      runbookFull: "/runbooks/0/full/",
      featured: false
    },
    {
      id: "10",
      phase: "stabilize",
      searchTitle: "How Do I Fix Flaky Playwright Selectors?",
      systemTitle: "Eliminate Fragile UI Locators",
      bullets: [
        "Locators use stable attributes",
        "Fragile selectors are identified",
        "Improved strategies are proposed",
        "Changes reduce instability"
      ],
      image: "/images/sprints/sprint-10.png",
      runbookPreview: "/runbooks/10/",
      runbookFull: "/runbooks/10/full/",
      featured: true
    }
  ];
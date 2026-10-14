// scripts/check_docs.js
// Verifies that every file path referenced in backticks across the project's
// documentation actually exists. Documentation that points at files which were
// renamed or deleted is worse than no documentation. Owned by Ammar

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DOCS = [
  'README.md',
  'CONTRACT.md',
  'SYSTEM_LEDGER.md',
  'AI_CONTEXT.md',
  'PROJECT_ROADMAP.md',
  'docs/api.md',
  'docs/architecture.md',
  'docs/submission.md',
  'docs/team_rules.md',
  'docs/handoff_policy.md'
];

const EXTENSIONS = ['js', 'json', 'md', 'yml', 'yaml', 'example', 'txt', 'pdf'];
const PATTERN = new RegExp('`([A-Za-z0-9_./-]+\\.(?:' + EXTENSIONS.join('|') + '|Dockerfile))`', 'g');

// References that intentionally describe removed or external things.
const ALLOW_MISSING = new Set([
  'SECURITY_CHECKLIST.md',       // explicitly called out as never existing
  'eval_results.json',           // generated artefact, gitignored
  'batch_results.json',          // generated artefact, gitignored
  'package-lock.json',
  'data/ground_truth.json',      // corpus not built yet
  'backend/metrics/batch_results.json' // generated artefact, gitignored
]);

// Paths documented as REMOVED in SYSTEM_LEDGER.md's removal table. They are
// listed deliberately so the team can see what was deleted and why. Keep this
// list in sync with that table; a path added here should appear there too.
const REMOVED = new Set([
  'src/routes/documents.js',
  'src/services/ruleEngine.js',
  'src/services/llmClient.js',
  'src/services/redactionService.js',
  'src/utils/ids.js',
  'src/config/env.js',
  'backend/scripts/run_batch.js'
]);

function candidates(ref) {
  return [
    ref,
    path.join('mocks', ref),
    path.join('backend', ref),
    path.join('backend', 'src', ref),
    path.join('backend', 'src', 'services', ref),
    path.join('backend', 'src', 'routes', ref),
    path.join('backend', 'src', 'models', ref),
    path.join('backend', 'src', 'middleware', ref),
    path.join('backend', 'src', 'rules', ref),
    path.join('backend', 'src', 'clients', ref),
    path.join('backend', 'tests', ref),
    path.join('backend', 'seed', ref),
    path.join('backend', 'fixtures', ref)
  ];
}

const references = new Map();

for (const doc of DOCS) {
  const docPath = path.join(ROOT, doc);
  if (!fs.existsSync(docPath)) continue;
  const text = fs.readFileSync(docPath, 'utf8');
  for (const match of text.matchAll(PATTERN)) {
    const ref = match[1];
    if (ALLOW_MISSING.has(ref)) continue;
    if (!references.has(ref)) references.set(ref, new Set());
    references.get(ref).add(doc);
  }
}

const missing = [];
let removedCount = 0;
for (const [ref, docs] of [...references.entries()].sort()) {
  const found = candidates(ref).some(c => fs.existsSync(path.join(ROOT, c)));
  if (found) continue;
  if (REMOVED.has(ref)) {
    removedCount++;
    continue;
  }
  missing.push({ ref, docs: [...docs].join(', ') });
}

console.log(`Checked ${references.size} file references across ${DOCS.length} documents.`);
if (removedCount > 0) {
  console.log(`(${removedCount} reference(s) point at files documented as removed.)`);
}

if (missing.length > 0) {
  console.error(`\n${missing.length} referenced path(s) do not exist:\n`);
  for (const m of missing) {
    console.error(`  ${m.ref}\n    referenced in: ${m.docs}`);
  }
  process.exit(1);
}

console.log('All referenced paths exist.');
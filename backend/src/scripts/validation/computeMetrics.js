/**
 * Pre-Assessment Validation — Metrics Calculator
 * ============================================================================
 * Reads a filled master CSV (the counselor_category / counselor_risk /
 * action_rating_1to4 columns completed from the blind rating sheet) and computes
 * the agreement, safety, and recommendation metrics defined in the validation
 * plan. Treats the COUNSELOR as ground truth and the SYSTEM as the prediction.
 *
 * Run from the backend/ directory:
 *   node src/scripts/validation/computeMetrics.js [path/to/filled_master.csv]
 * If no path is given, the most recent master_results_*.csv in ./results is used.
 *
 * Self-test the math (no CSV needed):
 *   node src/scripts/validation/computeMetrics.js --self-test
 *
 * Outputs a Markdown report to stdout and to ./results/metrics_report_<ts>.md
 *
 * action_rating_1to4 scale:  1 Appropriate · 2 Acceptable · 3 Needs minor edit · 4 Inappropriate
 * Risk order (ordinal):      Low(0) < Moderate(1) < High(2) < Critical(3)
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, "results");

const RISK_ORDER = ["Low", "Moderate", "High", "Critical"];
const HIGH_RISK = new Set(["High", "Critical"]); // "needs prompt attention" band

// ── RFC4180-style CSV parser (handles quoted fields w/ commas, quotes, newlines) ─
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// ── Cohen's kappa (nominal) ───────────────────────────────────────────────────
function cohensKappa(pairs) {
  const labels = [...new Set(pairs.flatMap(([a, b]) => [a, b]))];
  const n = pairs.length;
  if (!n) return { kappa: NaN, po: NaN, pe: NaN, labels };
  const idx = Object.fromEntries(labels.map((l, i) => [l, i]));
  const m = labels.map(() => labels.map(() => 0));
  const rowT = labels.map(() => 0), colT = labels.map(() => 0);
  let agree = 0;
  for (const [truth, pred] of pairs) {
    m[idx[truth]][idx[pred]]++;
    rowT[idx[truth]]++; colT[idx[pred]]++;
    if (truth === pred) agree++;
  }
  const po = agree / n;
  let pe = 0;
  for (let i = 0; i < labels.length; i++) pe += (rowT[i] / n) * (colT[i] / n);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { kappa, po, pe, labels, matrix: m, rowT, colT };
}

// ── Linear weighted kappa (ordinal) ──────────────────────────────────────────
function weightedKappa(pairs, order) {
  const n = pairs.length;
  const k = order.length;
  if (!n) return { kappa: NaN };
  const idx = Object.fromEntries(order.map((l, i) => [l, i]));
  const O = order.map(() => order.map(() => 0));
  const rowT = order.map(() => 0), colT = order.map(() => 0);
  for (const [truth, pred] of pairs) {
    O[idx[truth]][idx[pred]]++; rowT[idx[truth]]++; colT[idx[pred]]++;
  }
  const w = (i, j) => Math.abs(i - j) / (k - 1); // linear disagreement weight
  let numer = 0, denom = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const e = (rowT[i] * colT[j]) / n;
      numer += w(i, j) * O[i][j];
      denom += w(i, j) * e;
    }
  }
  const kappa = denom === 0 ? 1 : 1 - numer / denom;
  return { kappa, matrix: O, rowT, colT };
}

const landis = (k) =>
  isNaN(k) ? "n/a" :
  k < 0 ? "poor (worse than chance)" :
  k <= 0.20 ? "slight" :
  k <= 0.40 ? "fair" :
  k <= 0.60 ? "moderate" :
  k <= 0.80 ? "substantial" : "almost perfect";

const pct = (x, d = 0) => (isNaN(x) ? "n/a" : `${(x * 100).toFixed(d)}%`);
const f3 = (x) => (isNaN(x) ? "n/a" : x.toFixed(3));

// ── Render an N×N confusion matrix as a Markdown table ───────────────────────
function matrixMd(labels, matrix, rowT, colT) {
  const head = `| truth ↓ / system → | ${labels.join(" | ")} | **Σ** |`;
  const sep = `|${" --- |".repeat(labels.length + 2)}`;
  const body = labels.map((l, i) => `| **${l}** | ${matrix[i].join(" | ")} | ${rowT[i]} |`);
  const foot = `| **Σ** | ${colT.join(" | ")} | ${rowT.reduce((a, b) => a + b, 0)} |`;
  return [head, sep, ...body, foot].join("\n");
}

function buildReport(rows) {
  const usable = rows.filter((r) => r.counselor_category && r.counselor_risk);
  const skipped = rows.length - usable.length;
  const n = usable.length;

  const out = [];
  out.push(`# Pre-Assessment Validation — Results\n`);
  out.push(`_Generated ${new Date().toISOString()}_\n`);
  out.push(`Cases scored (counselor judgment present): **${n}**` +
    (skipped ? ` &nbsp;|&nbsp; skipped (incomplete): ${skipped}` : "") + `\n`);
  if (n < 10) out.push(`> ⚠ Fewer than 10 scored cases — below the panel minimum. Kappa is unstable at this size.\n`);

  // ── A. Category agreement ──
  const catPairs = usable.map((r) => [r.counselor_category, r.system_category]);
  const catAcc = catPairs.filter(([a, b]) => a === b).length / n;
  const ck = cohensKappa(catPairs);
  out.push(`## A. Category agreement (nominal)\n`);
  out.push(`| Metric | Value |\n| --- | --- |`);
  out.push(`| Exact accuracy | ${pct(catAcc, 1)} (${catPairs.filter(([a, b]) => a === b).length}/${n}) |`);
  out.push(`| Cohen's κ | ${f3(ck.kappa)} — *${landis(ck.kappa)}* |`);
  out.push(`| Observed / expected agreement | ${f3(ck.po)} / ${f3(ck.pe)} |\n`);
  out.push(`**Confusion matrix — category**\n`);
  out.push(matrixMd(ck.labels, ck.matrix, ck.rowT, ck.colT) + "\n");

  // ── B. Risk agreement (ordinal) ──
  const riskPairs = usable
    .filter((r) => RISK_ORDER.includes(r.counselor_risk) && RISK_ORDER.includes(r.system_risk))
    .map((r) => [r.counselor_risk, r.system_risk]);
  const rN = riskPairs.length;
  const ri = (l) => RISK_ORDER.indexOf(l);
  const exact = riskPairs.filter(([a, b]) => a === b).length;
  const adjacent = riskPairs.filter(([a, b]) => Math.abs(ri(a) - ri(b)) <= 1).length;
  const under = riskPairs.filter(([a, b]) => ri(b) < ri(a)).length; // system lower than counselor
  const over = riskPairs.filter(([a, b]) => ri(b) > ri(a)).length;  // system higher than counselor
  const wk = weightedKappa(riskPairs, RISK_ORDER);
  out.push(`## B. Risk-level agreement (ordinal)\n`);
  out.push(`| Metric | Value |\n| --- | --- |`);
  out.push(`| Exact accuracy | ${pct(exact / rN, 1)} (${exact}/${rN}) |`);
  out.push(`| Adjacent accuracy (±1 level) | ${pct(adjacent / rN, 1)} (${adjacent}/${rN}) |`);
  out.push(`| Linear weighted κ | ${f3(wk.kappa)} — *${landis(wk.kappa)}* |`);
  out.push(`| Under-escalation (system **lower**, ⚠ unsafe direction) | ${under} |`);
  out.push(`| Over-escalation (system higher, safe direction) | ${over} |\n`);
  out.push(`**Confusion matrix — risk**\n`);
  out.push(matrixMd(RISK_ORDER, wk.matrix, wk.rowT, wk.colT) + "\n");

  // ── C. Safety: high-risk detection (counselor = truth) ──
  const truthHigh = riskPairs.filter(([a]) => HIGH_RISK.has(a));
  const caughtHigh = truthHigh.filter(([, b]) => HIGH_RISK.has(b)).length;
  const sensitivity = truthHigh.length ? caughtHigh / truthHigh.length : NaN;
  const truthLow = riskPairs.filter(([a]) => !HIGH_RISK.has(a));
  const correctLow = truthLow.filter(([, b]) => !HIGH_RISK.has(b)).length;
  const specificity = truthLow.length ? correctLow / truthLow.length : NaN;
  const missed = truthHigh.filter(([, b]) => !HIGH_RISK.has(b));
  out.push(`## C. Safety — High/Critical detection (the metric that matters most)\n`);
  out.push(`Collapsing risk to **{High, Critical}** vs **{Low, Moderate}**, with the counselor as truth:\n`);
  out.push(`| Metric | Value | Target |\n| --- | --- | --- |`);
  out.push(`| Sensitivity / recall (High+Critical caught) | ${pct(sensitivity, 1)} (${caughtHigh}/${truthHigh.length}) | **100%** |`);
  out.push(`| Specificity (Low+Moderate kept low) | ${pct(specificity, 1)} (${correctLow}/${truthLow.length}) | high |`);
  if (missed.length) {
    out.push(`\n> 🚨 **${missed.length} under-detected high-risk case(s)** — the system rated a counselor-High/Critical student as Low/Moderate. List and investigate each:`);
    for (const [a, b] of missed) out.push(`> - counselor **${a}** → system **${b}**`);
    out.push("");
  } else if (truthHigh.length) {
    out.push(`\n> ✅ No under-detected high-risk cases — every High/Critical student (per counselor) was flagged High/Critical by the system.\n`);
  }

  // ── D. Recommendation appropriateness ──
  const ratings = usable.map((r) => parseInt(r.action_rating_1to4, 10)).filter((x) => x >= 1 && x <= 4);
  if (ratings.length) {
    const appropriate = ratings.filter((x) => x <= 2).length;
    const dist = [1, 2, 3, 4].map((s) => `${s}:${ratings.filter((x) => x === s).length}`).join("  ");
    out.push(`## D. Recommendation appropriateness (counselor-rated next action)\n`);
    out.push(`| Metric | Value | Target |\n| --- | --- | --- |`);
    out.push(`| Appropriate or Acceptable (rating 1–2) | ${pct(appropriate / ratings.length, 1)} (${appropriate}/${ratings.length}) | ≥ 90% |`);
    out.push(`| Rating distribution (1=Appropriate … 4=Inappropriate) | ${dist} | — |\n`);
  } else {
    out.push(`## D. Recommendation appropriateness\n_No action_rating_1to4 values provided — skipped._\n`);
  }

  // ── Acceptance summary ──
  out.push(`## Acceptance summary\n`);
  const verdict = (ok) => (ok ? "✅ met" : "❌ not met");
  out.push(`| Criterion | Result | Status |\n| --- | --- | --- |`);
  out.push(`| Category accuracy ≥ 80% **and** κ ≥ 0.60 | ${pct(catAcc, 1)}, κ=${f3(ck.kappa)} | ${verdict(catAcc >= 0.8 && ck.kappa >= 0.6)} |`);
  out.push(`| Risk adjacent-accuracy ≥ 95% | ${pct(adjacent / rN, 1)} | ${verdict(adjacent / rN >= 0.95)} |`);
  out.push(`| High-risk sensitivity = 100% | ${pct(sensitivity, 1)} | ${verdict(sensitivity === 1)} |`);
  if (ratings.length) {
    const appr = ratings.filter((x) => x <= 2).length / ratings.length;
    out.push(`| Next-action appropriateness ≥ 90% | ${pct(appr, 1)} | ${verdict(appr >= 0.9)} |`);
  }
  out.push("");
  return out.join("\n");
}

// ── Self-test: verify the math on known inputs ───────────────────────────────
function selfTest() {
  const log = [];
  const approx = (a, b, t = 1e-9) => Math.abs(a - b) < t;

  // Perfect agreement ⇒ κ = 1
  const perfect = [["Low", "Low"], ["High", "High"], ["Critical", "Critical"], ["Moderate", "Moderate"]];
  log.push(["Cohen κ perfect agreement = 1", approx(cohensKappa(perfect).kappa, 1)]);
  log.push(["Weighted κ perfect agreement = 1", approx(weightedKappa(perfect, RISK_ORDER).kappa, 1)]);

  // Known 2×2 Cohen's kappa: cells [[20,5],[10,15]], n=50 ⇒ po=.70, pe=.50, κ=.40
  const k2 = [];
  for (let i = 0; i < 20; i++) k2.push(["Y", "Y"]);
  for (let i = 0; i < 5; i++) k2.push(["Y", "N"]);
  for (let i = 0; i < 10; i++) k2.push(["N", "Y"]);
  for (let i = 0; i < 15; i++) k2.push(["N", "N"]);
  const r2 = cohensKappa(k2);
  log.push(["Cohen κ 2×2 textbook po=0.70", approx(r2.po, 0.7)]);
  log.push(["Cohen κ 2×2 textbook pe=0.50", approx(r2.pe, 0.5)]);
  log.push(["Cohen κ 2×2 textbook κ=0.40", approx(r2.kappa, 0.4)]);

  // Weighted κ penalises a 2-step miss more than a 1-step miss (numerically lower).
  const oneStep = [["Low", "Moderate"], ["High", "High"], ["Critical", "Critical"], ["Moderate", "Moderate"]];
  const twoStep = [["Low", "High"], ["High", "High"], ["Critical", "Critical"], ["Moderate", "Moderate"]];
  log.push(["Weighted κ: 2-step miss < 1-step miss",
    weightedKappa(twoStep, RISK_ORDER).kappa < weightedKappa(oneStep, RISK_ORDER).kappa]);

  console.log("SELF-TEST — metric math\n=======================");
  let allPass = true;
  for (const [name, pass] of log) {
    if (!pass) allPass = false;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log(`\n${allPass ? "✓ All checks passed." : "✗ Some checks FAILED."}`);
  process.exit(allPass ? 0 : 1);
}

// ── Entry ─────────────────────────────────────────────────────────────────────
function latestMaster() {
  if (!fs.existsSync(RESULTS_DIR)) return null;
  const files = fs.readdirSync(RESULTS_DIR)
    .filter((f) => /^master_results_.*\.csv$/.test(f))
    .map((f) => path.join(RESULTS_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function main() {
  const arg = process.argv[2];
  if (arg === "--self-test") return selfTest();

  const csvPath = arg || latestMaster();
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("No CSV found. Pass a path, or run runValidation.js first to create one.");
    console.error("Usage: node src/scripts/validation/computeMetrics.js [filled_master.csv]");
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  if (!rows.length) { console.error(`No data rows in ${csvPath}`); process.exit(1); }

  const report = buildReport(rows);
  console.log(report);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = path.join(RESULTS_DIR, `metrics_report_${stamp}.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`\n_Report written to ${path.relative(process.cwd(), reportPath)}_`);
}

main();

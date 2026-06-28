/**
 * Pre-Assessment Validation — Runner
 * ============================================================================
 * Drives every case in preAssessmentCases.js through the production rule engine
 * (analyzeAssessment + generateRecommendations), and records, per case:
 *   • detectedCategory / riskLevel / score average           (the classification)
 *   • suggestedNextAction + resource titles                  (the recommendation)
 *   • latency (ms) for the rule-based pipeline
 *   • determinism: identical output across 3 repeated runs?  (rule-based ⇒ true)
 *   • whether the engine reproduced the engineered designTarget
 *
 * It writes three artifacts into ./results :
 *   1. system_output_<ts>.json      full machine-readable detail (team archive)
 *   2. master_results_<ts>.csv      system output + BLANK counselor columns
 *                                   → paste the counselor's judgments here, then
 *                                     feed to computeMetrics.js
 *   3. counselor_blind_sheet_<ts>.csv   inputs only + blank counselor columns
 *                                   → print/share with the counselor (no system
 *                                     output visible, so the rating stays blind)
 *
 * NOTE ON SCOPE: this validates the deterministic engine — the part that makes
 * the clinical judgment. Gemini summaries are intentionally NOT called here:
 * the run completing with full category/risk/resources is itself the proof of
 * graceful degradation (the core output needs no external AI). To validate the
 * full HTTP path or the Gemini summaries, see docs/PreAssessment-Validation-Plan.md.
 *
 * Run from the backend/ directory:
 *   node src/scripts/validation/runValidation.js
 * MONGODB_URI in .env is OPTIONAL — without it, the classification still runs
 * and only the DB-backed recommendation lookup is skipped (built-in fallbacks
 * are reported instead, with a clear notice).
 * ============================================================================
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import mongoose from "mongoose";

import { analyzeAssessment } from "../../services/assessmentAnalyzer.js";
import { generateRecommendations } from "../../services/recommendationEngine.js";
import { CASES, toLikertResponses } from "./preAssessmentCases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, "results");
const REPEAT = 3; // runs per case for the determinism check

// ── Minimal RFC4180-style CSV writer ──────────────────────────────────────────
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(",");
const csvFile = (header, rows) => [csvRow(header), ...rows.map(csvRow)].join("\r\n") + "\r\n";

// ── Stable stringify so determinism comparison ignores key order ──────────────
const stable = (obj) =>
  JSON.stringify(obj, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v
  );

const ts = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Optional DB connection — needed only for the DB-backed recommendation lookup.
  let dbConnected = false;
  if (process.env.MONGODB_URI) {
    try {
      mongoose.set("sanitizeFilter", true); // mirror production (lib/db.js)
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      dbConnected = true;
      console.log("✓ Connected to MongoDB — recommendation engine will use seeded rules.\n");
    } catch (err) {
      console.warn(`! MongoDB connect failed (${err.message}).`);
      console.warn("  Continuing with built-in recommendation fallbacks.\n");
    }
  } else {
    console.warn("! MONGODB_URI not set — classification still runs; DB recommendation lookup skipped.\n");
  }

  const detail = [];
  const tableRows = [];
  let categoryHits = 0;
  let riskHits = 0;
  let determinismFailures = 0;

  for (const c of CASES) {
    const likertResponses = toLikertResponses(c.likertScores);
    const analyzeInput = {
      likertResponses,
      purposeOfVisit: c.payload.purposeOfVisit,
      concernCategories: c.payload.concernCategories,
      urgencyLevel: c.payload.urgencyLevel,
    };

    // ── Timed primary run (analyze + recommend) ──
    const t0 = performance.now();
    const analysis = analyzeAssessment(analyzeInput);
    let recommendation = null;
    if (dbConnected) {
      recommendation = await generateRecommendations({
        detectedCategory: analysis.detectedCategory,
        riskLevel: analysis.riskLevel,
        purposeOfVisit: c.payload.purposeOfVisit,
      });
    }
    const latencyMs = +(performance.now() - t0).toFixed(3);

    // ── Determinism: repeat and compare the rule-based output ──
    const baseline = stable({ analysis, recommendation });
    let deterministic = true;
    for (let i = 1; i < REPEAT; i++) {
      const a2 = analyzeAssessment(analyzeInput);
      const r2 = dbConnected
        ? await generateRecommendations({
            detectedCategory: a2.detectedCategory,
            riskLevel: a2.riskLevel,
            purposeOfVisit: c.payload.purposeOfVisit,
          })
        : null;
      if (stable({ analysis: a2, recommendation: r2 }) !== baseline) deterministic = false;
    }
    if (!deterministic) determinismFailures++;

    const categoryMatch = analysis.detectedCategory === c.designTarget.category;
    const riskMatch = analysis.riskLevel === c.designTarget.risk;
    if (categoryMatch) categoryHits++;
    if (riskMatch) riskHits++;

    const resourceTitles = (recommendation?.suggestedResources || []).map((r) => r.title);

    detail.push({
      id: c.id,
      title: c.title,
      designTarget: c.designTarget,
      input: {
        likertScores: c.likertScores,
        purposeOfVisit: c.payload.purposeOfVisit,
        concernCategories: c.payload.concernCategories,
        urgencyLevel: c.payload.urgencyLevel,
      },
      systemOutput: {
        detectedCategory: analysis.detectedCategory,
        riskLevel: analysis.riskLevel,
        scoreAverage: analysis.scoreBreakdown.average,
        scoreBreakdown: analysis.scoreBreakdown,
        riskFactors: analysis.riskFactors,
        suggestedNextAction: recommendation?.suggestedNextAction ?? "(DB not connected)",
        suggestedResources: resourceTitles,
        counselorPreparationNotes: recommendation?.counselorPreparationNotes ?? "",
      },
      checks: { categoryMatch, riskMatch, deterministic, latencyMs },
    });

    tableRows.push({
      Case: c.id,
      "Design cat→risk": `${c.designTarget.category} / ${c.designTarget.risk}`,
      "System cat→risk": `${analysis.detectedCategory} / ${analysis.riskLevel}`,
      avg: analysis.scoreBreakdown.average,
      cat: categoryMatch ? "✓" : "✗",
      risk: riskMatch ? "✓" : "✗",
      det: deterministic ? "✓" : "✗",
      ms: latencyMs,
    });
  }

  // ── Console report ──
  console.log("PRE-ASSESSMENT VALIDATION — ENGINE RUN");
  console.log("======================================\n");
  console.table(tableRows);

  const n = CASES.length;
  console.log("\nEngine-vs-designTarget reproduction (sanity check, NOT the validation result):");
  console.log(`  Category reproduced : ${categoryHits}/${n}`);
  console.log(`  Risk reproduced     : ${riskHits}/${n}`);
  console.log(`  Determinism         : ${n - determinismFailures}/${n} cases identical across ${REPEAT} runs`);
  console.log(`  Recommendation src  : ${dbConnected ? "DB rules (seeded)" : "built-in fallbacks (no DB)"}`);
  if (categoryHits !== n || riskHits !== n) {
    console.log(
      "\n  ⚠ A design mismatch means a persona no longer elicits its engineered branch\n" +
      "    (e.g. the engine changed). Inspect the ✗ rows above — this is a finding about\n" +
      "    the dataset/engine, separate from counselor agreement."
    );
  }

  // ── Write artifacts ──
  const stamp = ts();
  const jsonPath = path.join(RESULTS_DIR, `system_output_${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), dbConnected, detail }, null, 2));

  // Master results (system output + blank counselor columns).
  const masterHeader = [
    "case_id", "design_category", "design_risk",
    "purpose_of_visit", "concern_categories", "urgency", "likert_scores", "likert_avg",
    "concern_description",
    "system_category", "system_risk", "system_next_action", "latency_ms", "determinism_ok",
    "counselor_category", "counselor_risk", "action_rating_1to4", "counselor_notes",
  ];
  const masterRows = CASES.map((c, i) => {
    const d = detail[i];
    return [
      c.id, c.designTarget.category, c.designTarget.risk,
      c.payload.purposeOfVisit.join("; "),
      c.payload.concernCategories.join("; "),
      c.payload.urgencyLevel,
      c.likertScores.join("|"),
      d.systemOutput.scoreAverage,
      c.payload.concernDescription,
      d.systemOutput.detectedCategory, d.systemOutput.riskLevel,
      d.systemOutput.suggestedNextAction, d.checks.latencyMs, d.checks.deterministic ? "TRUE" : "FALSE",
      "", "", "", "", // ← counselor fills these (blind), then this file goes to computeMetrics.js
    ];
  });
  const masterPath = path.join(RESULTS_DIR, `master_results_${stamp}.csv`);
  fs.writeFileSync(masterPath, csvFile(masterHeader, masterRows));

  // Blind sheet (inputs only — NO design/system columns, so the counselor is not anchored).
  const blindHeader = [
    "case_id", "purpose_of_visit", "concern_categories", "urgency",
    "likert_responses", "concern_description",
    "counselor_category", "counselor_risk", "action_rating_1to4", "counselor_notes",
  ];
  const blindRows = CASES.map((c) => [
    c.id,
    c.payload.purposeOfVisit.join("; "),
    c.payload.concernCategories.join("; "),
    c.payload.urgencyLevel,
    c.likertScores.map((s, i) => `Q${i + 1}=${s}`).join("; "),
    c.payload.concernDescription,
    "", "", "", "",
  ]);
  const blindPath = path.join(RESULTS_DIR, `counselor_blind_sheet_${stamp}.csv`);
  fs.writeFileSync(blindPath, csvFile(blindHeader, blindRows));

  console.log("\nArtifacts written:");
  console.log(`  • ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`  • ${path.relative(process.cwd(), masterPath)}   (paste counselor judgments here)`);
  console.log(`  • ${path.relative(process.cwd(), blindPath)}   (give this to the counselor)`);

  if (dbConnected) await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Validation run failed:", err);
  process.exit(1);
});

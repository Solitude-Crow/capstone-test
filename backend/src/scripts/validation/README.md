# Pre-Assessment Validation Harness

Tooling to validate the pre-assessment **classification engine** (category +
risk + recommendation) against expert guidance-counselor judgment, per the
panel's request for a ≥10-case validation. Full method, criteria, and the
counselor brief live in [`docs/PreAssessment-Validation-Plan.md`](../../../docs/PreAssessment-Validation-Plan.md).

## Files

| File | Purpose |
| --- | --- |
| `preAssessmentCases.js` | 12 stratified synthetic personas (complete pre-assessment payloads) covering all 8 categories, all 4 risk levels, both Critical safety paths, and 2 threshold-boundary probes. |
| `runValidation.js` | Runs every case through `analyzeAssessment` + `generateRecommendations`, measures latency, checks determinism (3× re-run), and writes the result artifacts. |
| `computeMetrics.js` | Reads the **filled** master CSV and computes accuracy, Cohen's/weighted κ, high-risk sensitivity, confusion matrices, and the acceptance summary. |
| `results/` | Generated artifacts land here (git-ignored except `.gitkeep`). |

## Workflow

```bash
# 1. (optional but recommended) seed the DB so the recommendation engine uses
#    the real counselor-approved rules instead of built-in fallbacks
npm run seed:guidance

# 2. Run the cases through the engine. Produces three files in results/:
#      system_output_<ts>.json        – full machine detail (archive)
#      master_results_<ts>.csv        – system output + BLANK counselor columns
#      counselor_blind_sheet_<ts>.csv – inputs only, for the counselor (blind)
npm run validate:preassess

# 3. Give counselor_blind_sheet_<ts>.csv to the guidance counselor. They fill
#    counselor_category, counselor_risk, action_rating_1to4, counselor_notes
#    WITHOUT seeing the system output. (Two counselors → stronger study.)

# 4. Copy their four columns into master_results_<ts>.csv, then:
npm run validate:metrics                       # uses the newest master_results_*.csv
#   or point at a specific file:
node src/scripts/validation/computeMetrics.js path/to/master_results_<ts>.csv

# Verify the metric math itself at any time:
node src/scripts/validation/computeMetrics.js --self-test
```

## Notes

- **MongoDB is optional for step 2.** Without `MONGODB_URI`, classification still
  runs; only the DB-backed recommendation lookup is skipped (a notice is printed).
  The run completing with full category/risk output is itself the evidence of
  graceful degradation — the core engine needs no database and no external AI.
- **`designTarget` ≠ ground truth.** It only records which engine branch each
  persona was built to exercise (the runner confirms 12/12 reproduction). Ground
  truth is the counselor's blind judgment.
- **Gemini is intentionally not called here** (it only writes advisory summaries,
  not the classification). Validate the summaries separately — see the plan doc.
- `action_rating_1to4`: **1** Appropriate · **2** Acceptable · **3** Needs minor edit · **4** Inappropriate.

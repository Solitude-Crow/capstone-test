# Pre-Assessment Feature — Validation Plan & Testing Criteria

**System:** MKD Guidance Management System — Student Pre-Assessment
**Component under test:** Pre-assessment classification & recommendation engine
**Document version:** 1.0 · **Prepared:** June 24, 2026
**Validation lead:** _________________  **Expert validator(s):** _________________ (Guidance Counselor)

---

## 1. Purpose

The panel requested a validation of the pre-assessment feature across **at least
10 cases**. This document defines *what* is being validated, *how* the test is
conducted, the *metrics* recorded, and the *acceptance criteria* against which
results are judged. It is designed so the study is reproducible and defensible.

## 2. What the feature does (system under test)

When a student submits the pre-assessment form, the backend produces a structured
assessment through a **deterministic, rule-based pipeline** (no AI decides the
outcome):

| Output | Produced by | Nature |
| --- | --- | --- |
| `detectedCategory` | decision tree over the 8 Likert scores → purpose-of-visit → concern tags (`services/assessmentAnalyzer.js`) | 8-class **nominal** |
| `riskLevel` | overall average + count of "Always" (5) responses + self-assessed urgency (`services/assessmentAnalyzer.js`) | 4-level **ordinal** |
| `scoreBreakdown` | per-domain averages (academic, emotional, social, family, career) + overall | numeric |
| `suggestedNextAction`, `suggestedResources`, `counselorPreparationNotes` | counselor-approved rules / built-in fallbacks (`services/recommendationEngine.js`) | text |
| `studentSummary`, `counselorSummary` | **optional** Google Gemini call (`services/ai.js`) | advisory text only |

> **Key point for the defense:** Gemini *only* phrases human-readable summaries.
> It does **not** determine the category, risk, or resources. The clinical logic
> is transparent, rule-based, and reproducible — not a black box. If Gemini is
> unavailable, the assessment is still produced in full (`geminiUsed: false`).

### 2.1 Classification rules (reference)

Likert items are mapped **by position**. Order (1–8):

1. Overwhelmed by school requirements *(academic)*
2. Difficulty concentrating *(academic)*
3. Stressed/anxious frequently *(emotional)*
4. Problems with friends/classmates *(social)*
5. Concerns about family situation *(family)*
6. Uncertain about career path *(career)*
7. Isolated/unsupported *(emotional)*
8. Concerns affect academic performance *(academic)*

**Category** — first matching rule wins (precedence order):

1. **Academic Burnout** — (Q3 ≥ 4 **or** Q1 ≥ 4) **and** Q8 ≥ 4
2. **Career Planning** — Q6 ≥ 4
3. **Family Concern** — Q5 ≥ 4
4. **Social/Relationship Concern** — Q4 ≥ 4
5. **Personal/Emotional Concern** — Q3 ≥ 4 **or** Q7 ≥ 4
6. **Academic Concern** — Q1 ≥ 3 **or** Q8 ≥ 3
7. Fallback to **purpose of visit**, then **concern categories**
8. **General Concern** (nothing matched)

**Risk level:**

- **Critical** — urgency is *Immediate*/*Crisis* **or** ≥ 3 responses are "Always" (5)
- **High** — overall average ≥ 4.0
- **Moderate** — overall average ≥ 2.5
- **Low** — otherwise

## 3. Validation type

Two complementary layers:

- **Criterion (concurrent) validity** — does the system's automated
  classification agree with an expert guidance counselor's professional judgment
  on the same inputs? *This is the substantive validation the panel cares about.*
- **Functional/technical validation** — does the feature work correctly,
  responsively, reproducibly, and degrade gracefully?

## 4. Test design — blind expert-agreement study

1. **Ground truth = the guidance counselor.** For each case the counselor records
   their **own** category, risk level, and a rating of the recommended next action
   **before seeing any system output** (blind), so they are not anchored to the
   machine.
2. **Inputs are fixed, realistic cases** (Section 6) presented identically to the
   system and the counselor.
3. **The system processes each case** via the rule engine (and, optionally, the
   live HTTP endpoint) — see procedures in Section 7.
4. **Agreement is scored** by `computeMetrics.js` with the counselor as truth and
   the system as the prediction.
5. **(Recommended) two counselors rate independently.** Reporting the agreement
   *between the two humans* (inter-rater reliability) establishes the reliability
   ceiling of the ground truth itself and strengthens the study.

### 4.1 Blinding & independence
- The counselor receives only `counselor_blind_sheet_<ts>.csv` (inputs + blank
  judgment columns). It contains **no** system output and **no** design labels.
- Counselor judgments are transcribed into `master_results_<ts>.csv` only **after**
  they are finalized.

## 5. Sample size

The panel's floor is **10**. This plan uses **12** so that **all 8 categories**
and **all 4 risk levels** are represented, both **Critical** safety paths are
exercised, and two **threshold-boundary** cases are included. More cases are
better: with n ≈ 10–12, κ has wide confidence intervals, so results lean on
exact accuracy and high-risk sensitivity, with κ reported as supporting evidence.

## 6. Test cases

12 stratified synthetic personas (`scripts/validation/preAssessmentCases.js`).
Each is a complete, realistic submission. The "Tests" column states the engine
branch the case was engineered to exercise (the runner confirms the engine
reproduces every one — see Section 9). **The engineered label is *not* the ground
truth; the counselor's blind judgment is.**

| ID | Persona (short) | Likert (Q1–Q8) | Urgency | Engineered category / risk | Tests |
| --- | --- | --- | --- | --- | --- |
| PA-01 | Overloaded, exhausted, grades slipping | 5,4,4,4,3,3,4,5 | High | Academic Burnout / High | Burnout rule + High via avg ≥ 4 |
| PA-02 | Somewhat behind, manageable | 4,3,3,2,2,2,2,3 | Moderate | Academic Concern / Moderate | Academic (non-burnout) branch |
| PA-03 | Fine, unsure of career | 2,2,2,1,1,4,2,2 | Low | Career Planning / Low | Career branch, Low risk |
| PA-04 | Parents separating, unsupported | 4,4,4,4,5,3,5,3 | High | Family Concern / High | Family precedence over Social |
| PA-05 | Peer conflict | 2,2,3,5,2,2,3,2 | Moderate | Social/Relationship / Moderate | Social branch |
| PA-06 | Anxious, isolated, low academic spillover | 3,3,5,3,2,2,5,3 | Moderate | Personal/Emotional / Moderate | Emotional branch |
| PA-07 | Financial/scholarship pressure | 2,2,2,1,1,2,2,2 | Low | Financial Concern / Low | Purpose-fallback path |
| PA-08 | First-year adjusting, nothing specific | 2,2,2,2,2,2,2,2 | Low | General Concern / Low | Final General fallback |
| PA-09 | Acute distress, asks for urgent help | 3,3,4,2,2,2,4,3 | **Immediate** | Personal/Emotional / **Critical** | **Safety path 1:** urgency → Critical |
| PA-10 | Three "Always", rates self only High | 5,4,5,2,2,2,5,4 | High | Academic Burnout / **Critical** | **Safety path 2:** 3×"Always" → Critical |
| PA-11 | Threshold probe | 3,3,3,2,2,2,2,3 | Low | Academic Concern / Moderate | **Boundary:** avg = 2.50 → Moderate |
| PA-12 | Threshold probe (vs PA-01) | 4,4,4,4,3,3,4,5 | Moderate | Academic Burnout / Moderate | **Boundary:** avg = 3.875 → not High |

Coverage: categories 8/8 · risk Low ×3, Moderate ×5, High ×2, Critical ×2 ·
Critical triggers: urgency ×1, "Always"-count ×1 · boundary probes ×2.

> If **anonymized real cases** are available, substitute or augment with them —
> real submissions strengthen external validity. Keep the same stratification
> goals and the same blind procedure.

## 7. Procedures

### 7.1 Engine-level validation (primary, recommended)
Cleanly isolates the algorithm; no auth, server, or network required.

1. *(Optional)* Seed counselor-approved rules so recommendations come from the DB
   rather than built-in fallbacks: `npm run seed:guidance`.
2. Run `npm run validate:preassess`. Confirm the console shows **12/12** category
   and risk reproduction and **12/12** determinism. Three files appear in
   `scripts/validation/results/`.
3. Print/share `counselor_blind_sheet_<ts>.csv` with the counselor(s).
4. Counselor completes, **blind**, for every case: `counselor_category`,
   `counselor_risk`, `action_rating_1to4`, `counselor_notes` (Section 8 rubric).
5. Transcribe the four counselor columns into `master_results_<ts>.csv`.
6. Run `npm run validate:metrics`. Archive the printed report and the saved
   `metrics_report_<ts>.md`.

### 7.2 End-to-end (HTTP) validation (optional, demonstrates the live path)
Confirms routing, validation, persistence, latency, and field-level privacy.

1. Start the API (`npm run dev`) with the DB seeded and a test student account.
2. For each case, `POST /api/pre-assessments` with the case `payload` (and the
   `likertResponses` built from `likertScores`). Record HTTP status and the
   response time.
3. Verify the persisted document's `assessmentResults` matches the engine output.
4. **Privacy check:** confirm the **student** response and the student GET
   endpoints do **not** contain `counselorPreparationNotes` or `counselorSummary`
   (the controller strips these — see `controllers/preAssessment.controller.js`).
5. **Graceful degradation:** run once with `GEMINI_API_KEY` unset and confirm a
   complete assessment is still returned with `geminiUsed: false`.

### 7.3 AI-summary safety check (only if Gemini is enabled)
The summaries are advisory text; validate them separately for safety, not accuracy:
have the counselor confirm each summary (a) uses hedged language ("may indicate",
"appears to suggest"), (b) makes **no** diagnosis, and (c) is non-alarming to the
student. Record pass/fail per case.

## 8. Metrics & acceptance criteria

Computed automatically by `computeMetrics.js` (counselor = truth, system = prediction).

### 8.1 Category agreement (nominal)
| Metric | Definition | Target |
| --- | --- | --- |
| Exact accuracy | matches ÷ scored cases | ≥ 80% |
| Cohen's κ | chance-corrected agreement | ≥ 0.60 (substantial) |
| Confusion matrix | truth × prediction | qualitative — shows *where* it errs |

### 8.2 Risk-level agreement (ordinal)
| Metric | Definition | Target |
| --- | --- | --- |
| Exact accuracy | exact level matches | ≥ 80% |
| Adjacent accuracy | within ±1 level | ≥ 95% |
| Linear weighted κ | penalizes larger gaps more | ≥ 0.60 |
| Under-escalation count | system rated **lower** than counselor (unsafe direction) | minimize → 0 |
| Over-escalation count | system rated higher (safe direction) | acceptable |

### 8.3 Safety — High/Critical detection (most important)
Risk collapsed to {High, Critical} vs {Low, Moderate}.
| Metric | Definition | Target |
| --- | --- | --- |
| **Sensitivity / recall** | counselor-High/Critical cases the system also flags High/Critical | **100%** |
| Specificity | counselor-Low/Moderate kept Low/Moderate | high |

Any under-detected high-risk case is reported individually and **must** be
investigated — missing a high-risk student is the failure mode that matters most.

### 8.4 Recommendation appropriateness
| Metric | Definition | Target |
| --- | --- | --- |
| Appropriate-or-Acceptable | next actions rated 1–2 by the counselor | ≥ 90% |

*Caveat (state it):* the action rules are counselor-defined, so this partly
validates the rule base, not only the classifier. The classification metrics
(8.1–8.3) are the cleaner test of the algorithm.

### 8.5 Functional / technical
| Metric | How captured | Target |
| --- | --- | --- |
| Submission success | HTTP 201 + populated `assessmentResults` (7.2) | 12/12 |
| Latency | engine time (runner) / response time (HTTP) | report; engine ≪ 50 ms |
| Determinism / test–retest | runner re-runs each case 3×; outputs identical | 100% |
| Graceful degradation | Gemini unset → full output, `geminiUsed:false` (7.2 §5) | pass |
| Privacy / data isolation | counselor-only fields absent from student responses (7.2 §4) | pass |

### 8.6 Headline acceptance criteria
- Category accuracy ≥ 80% **and** Cohen's κ ≥ 0.60
- Risk adjacent-accuracy ≥ 95% **with High-risk sensitivity = 100%**
- Next-action appropriateness ≥ 90%
- 100% submission success, deterministic re-runs, correct offline degradation,
  no privacy leakage

κ interpretation (Landis & Koch): 0.41–0.60 moderate · 0.61–0.80 substantial ·
0.81–1.00 almost perfect.

## 9. Engine reproduction check (already executed)

`runValidation.js` was run against the current engine. Result:

- **Category reproduced:** 12/12  · **Risk reproduced:** 12/12
- **Determinism:** 12/12 cases identical across 3 runs
- **Latency:** sub-millisecond per case (rule-based, no network)

This confirms the dataset exercises the intended branches and the engine is
deterministic. It is a *sanity check of the instrument*, separate from — and
prior to — the counselor-agreement result.

## 10. Scoring rubric (for the counselor)

- **Category** — choose exactly one: Academic Burnout · Academic Concern ·
  Career Planning · Family Concern · Social/Relationship Concern ·
  Personal/Emotional Concern · Financial Concern · General Concern.
- **Risk level** — choose one: Low · Moderate · High · Critical.
  - *Low* — advice/information only.
  - *Moderate* — counseling advisable in the next few days.
  - *High* — significantly affecting the student; follow-up within 24–48 h.
  - *Critical* — crisis / possible risk of harm; urgent intervention.
- **`action_rating_1to4`** for the system's suggested next action:
  **1** Appropriate · **2** Acceptable · **3** Needs minor edit · **4** Inappropriate.
- **Notes** — brief rationale, especially for any disagreement.

## 11. Threats to validity & mitigations

| Threat | Mitigation |
| --- | --- |
| Small n → unstable κ, wide CIs | Use 12 (> floor); lead with accuracy & sensitivity; report κ as supporting. |
| Single rater = subjective truth | Use ≥ 2 counselors; report inter-rater agreement. |
| Synthetic cases ≠ real population | Co-design personas with the counselor; augment with anonymized real cases if available. |
| Counselor anchoring to the system | Strict blinding (blind sheet has no system output). |
| Circularity in recommendation rules | Treat classification (8.1–8.3) as the primary, cleaner test; flag the caveat for 8.4. |
| "Personal/Emotional + High" rarely occurs by average | Documented engine characteristic (a purely emotional profile tends to Moderate, then jumps to Critical via the Immediate / 3×"Always" rule). Note it rather than treat each as an error. |

## 12. Ethics & data handling

- Use **synthetic** or **fully anonymized** cases — no identifying student data in
  the dataset, CSVs, or report.
- Obtain consent from participating counselor(s) to use their professional
  judgments in the capstone documentation.
- Store result artifacts with the rest of the confidential study materials; the
  feature itself treats submissions as confidential (form Section G consent).

## 13. Reporting

Include in the capstone documentation:
1. This plan (method + criteria).
2. The case table (Section 6).
3. The generated `metrics_report_<ts>.md`: both confusion matrices, all metric
   tables, and the acceptance summary.
4. A short narrative of every disagreement and its direction (with the counselor's
   notes), and any technical findings (latency, determinism, degradation, privacy).
5. Inter-rater agreement (if two counselors participated).

---

### Appendix A — Artifacts produced
| File | Contents |
| --- | --- |
| `results/system_output_<ts>.json` | Full per-case engine output (archive). |
| `results/master_results_<ts>.csv` | System output + blank counselor columns → fill → metrics input. |
| `results/counselor_blind_sheet_<ts>.csv` | Inputs + blank judgment columns (given to the counselor). |
| `results/metrics_report_<ts>.md` | Computed metrics, confusion matrices, acceptance summary. |

### Appendix B — Commands
```bash
npm run seed:guidance        # optional: load counselor-approved recommendation rules
npm run validate:preassess   # run the 12 cases → results/
npm run validate:metrics     # score the filled master CSV → metrics report
node src/scripts/validation/computeMetrics.js --self-test   # verify the metric math
```

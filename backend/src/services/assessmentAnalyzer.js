/**
 * Assessment Analyzer
 *
 * Converts Likert-scale self-assessment responses into structured analysis:
 * - per-domain score breakdown
 * - weighted average
 * - deterministic category detection (decision tree)
 * - risk level classification
 * - human-readable risk factors
 *
 * No external calls. Pure, synchronous, testable logic.
 */

// ── Likert statement → domain mapping ─────────────────────────────────────────
// Indices match the MKD form order (0-based)
const DOMAIN_MAP = [
  "academic",   // 0 – overwhelmed by school requirements
  "academic",   // 1 – difficulty concentrating
  "emotional",  // 2 – stressed or anxious
  "social",     // 3 – problems with friends/classmates
  "family",     // 4 – family concerns
  "career",     // 5 – uncertain about career path
  "emotional",  // 6 – isolated/unsupported
  "academic",   // 7 – concerns affect academic performance
];

const DOMAINS = ["academic", "emotional", "social", "family", "career"];

// ── Compute per-domain averages ────────────────────────────────────────────────
function buildScoreBreakdown(likertScores) {
  const sums   = { academic: 0, emotional: 0, social: 0, family: 0, career: 0 };
  const counts = { academic: 0, emotional: 0, social: 0, family: 0, career: 0 };

  likertScores.forEach((score, i) => {
    const domain = DOMAIN_MAP[i];
    if (domain) {
      sums[domain]   += score;
      counts[domain] += 1;
    }
  });

  const breakdown = {};
  DOMAINS.forEach((d) => {
    breakdown[d] = counts[d] > 0
      ? Math.round((sums[d] / counts[d]) * 100) / 100
      : 0;
  });

  const total      = likertScores.reduce((s, v) => s + v, 0);
  breakdown.average = likertScores.length > 0
    ? Math.round((total / likertScores.length) * 100) / 100
    : 0;

  return breakdown;
}

// ── Decision tree — deterministic category detection ──────────────────────────
function detectCategory(scores, purposeOfVisit = [], concernCategories = []) {
  const [overwhelmed, , stressed, social, family, career, isolated, academicAffected] = scores;

  // Academic Burnout (Phase 6: Stress >= 4 AND Academic Performance >= 4).
  // Treat "overwhelmed by requirements" as an equivalent exhaustion signal so
  // the classic burnout pattern (exhaustion + reduced academic efficacy) is caught.
  if ((stressed >= 4 || overwhelmed >= 4) && academicAffected >= 4) return "Academic Burnout";

  // Career Planning
  if (career >= 4) return "Career Planning";

  // Family Concern
  if (family >= 4) return "Family Concern";

  // Social/Relationship
  if (social >= 4) return "Social/Relationship Concern";

  // Personal/Emotional — stressed + isolated
  if (stressed >= 4 || isolated >= 4) return "Personal/Emotional Concern";

  // Academic (without full burnout pattern)
  if (overwhelmed >= 3 || academicAffected >= 3) return "Academic Concern";

  // Fall back to declared purpose of visit
  const purposeMap = [
    [["Academic Concerns"], "Academic Concern"],
    [["Career Planning"], "Career Planning"],
    [["Family Concerns"], "Family Concern"],
    [["Relationship Concerns"], "Social/Relationship Concern"],
    [["Emotional or Mental Well-being", "Stress Management", "Behavioral Concerns", "Personal Concerns"], "Personal/Emotional Concern"],
    [["Financial Concerns", "Scholarship Concerns"], "Financial Concern"],
  ];

  for (const [keys, category] of purposeMap) {
    if (keys.some((k) => purposeOfVisit.includes(k))) return category;
  }

  // Fall back to selected concern categories
  if (concernCategories.some((c) =>
    ["Low Grades", "Poor Study Habits", "Attendance Issues", "Time Management", "Academic Burnout", "Difficulty Understanding Lessons"].includes(c)
  )) return "Academic Concern";

  if (concernCategories.some((c) =>
    ["Career Decision-Making", "Course Shifting Concerns", "Internship Concerns", "Employment Preparation"].includes(c)
  )) return "Career Planning";

  if (concernCategories.some((c) =>
    ["Family Conflict", "Separation of Parents", "Lack of Family Support"].includes(c)
  )) return "Family Concern";

  if (concernCategories.some((c) =>
    ["Peer Conflict", "Bullying", "Romantic Relationship Concerns", "Social Anxiety"].includes(c)
  )) return "Social/Relationship Concern";

  if (concernCategories.some((c) =>
    ["Financial Difficulties", "Financial Concerns"].includes(c)
  )) return "Financial Concern";

  return "General Concern";
}

// ── Risk level classification ──────────────────────────────────────────────────
function detectRiskLevel(scores, urgencyLevel) {
  const avg = scores.length > 0
    ? scores.reduce((s, v) => s + v, 0) / scores.length
    : 0;
  const alwaysCount = scores.filter((v) => v === 5).length;

  const isCriticalUrgency = urgencyLevel === "Immediate" || urgencyLevel === "Crisis";
  if (isCriticalUrgency || alwaysCount >= 3) return "Critical";
  if (avg >= 4) return "High";
  if (avg >= 2.5) return "Moderate";
  return "Low";
}

// ── Build human-readable risk factors list ─────────────────────────────────────
const STATEMENT_LABELS = [
  "Feeling overwhelmed by school requirements",
  "Difficulty concentrating in class",
  "Frequent stress or anxiety",
  "Problems with friends or classmates",
  "Concerns regarding family situation",
  "Uncertainty about future career path",
  "Feeling isolated or unsupported",
  "Concerns affecting academic performance",
];

function buildRiskFactors(scores, urgencyLevel) {
  const factors = [];

  scores.forEach((score, i) => {
    if (score >= 4) {
      const label = STATEMENT_LABELS[i] || `Statement ${i + 1}`;
      factors.push(
        score === 5
          ? `${label} (Always)`
          : `${label} (Often)`
      );
    }
  });

  if (urgencyLevel === "Immediate" || urgencyLevel === "Crisis") {
    factors.push("Student self-assessed urgency as Immediate");
  } else if (urgencyLevel === "High") {
    factors.push("Student self-assessed urgency as High");
  }

  return factors;
}

// ── Main export ────────────────────────────────────────────────────────────────
/**
 * @param {Object} params
 * @param {Array<{statement: string, score: number}>} params.likertResponses
 * @param {string[]} params.purposeOfVisit
 * @param {string[]} params.concernCategories
 * @param {string} params.urgencyLevel
 * @returns {{ detectedCategory, riskLevel, riskFactors, scoreBreakdown }}
 */
export function analyzeAssessment({
  likertResponses = [],
  purposeOfVisit = [],
  concernCategories = [],
  urgencyLevel = "Low",
}) {
  const scores = likertResponses.map((r) => Number(r.score) || 1);

  const scoreBreakdown = buildScoreBreakdown(scores);
  const detectedCategory = detectCategory(scores, purposeOfVisit, concernCategories);
  const riskLevel = detectRiskLevel(scores, urgencyLevel);
  const riskFactors = buildRiskFactors(scores, urgencyLevel);

  return {
    detectedCategory,
    riskLevel,
    riskFactors,
    scoreBreakdown,
  };
}

/**
 * Pre-Assessment Validation — Test Case Dataset
 * ============================================================================
 * 12 stratified synthetic personas used to validate the pre-assessment
 * classification engine against expert (guidance counselor) judgment.
 *
 * Each case is a COMPLETE pre-assessment payload, so it can be either:
 *   (a) run through the rule engine directly (runValidation.js), or
 *   (b) POSTed to /api/pre-assessments to test the full HTTP pipeline.
 *
 * `designTarget` records the category/risk each persona was ENGINEERED to
 * elicit from the engine. IMPORTANT: designTarget is NOT the ground truth.
 * The ground truth is the guidance counselor's BLIND judgment recorded on the
 * counselor rating sheet. designTarget exists only so the team can sanity-check
 * that the engine behaves as the decision tree in assessmentAnalyzer.js says it
 * should, and to guarantee the dataset exercises every branch.
 *
 * The Likert order below is fixed and MUST match assessmentAnalyzer.js, which
 * maps responses BY POSITION (index), not by statement text:
 *   0 overwhelmed (academic)   4 family (family)
 *   1 concentrate (academic)   5 career (career)
 *   2 stressed   (emotional)   6 isolated (emotional)
 *   3 social     (social)      7 academicAffected (academic)
 * ============================================================================
 */

// Mirrors frontend src/lib/utils.js → LIKERT_STATEMENTS (kept here so the
// backend validation harness is self-contained).
export const LIKERT_STATEMENTS = [
  "I feel overwhelmed by school requirements.",
  "I have difficulty concentrating in class.",
  "I feel stressed or anxious frequently.",
  "I experience problems with friends or classmates.",
  "I have concerns regarding my family situation.",
  "I am uncertain about my future career path.",
  "I feel isolated or unsupported.",
  "My concerns affect my academic performance.",
];

export const LIKERT_LABELS = { 1: "Never", 2: "Rarely", 3: "Sometimes", 4: "Often", 5: "Always" };

// Shared, reusable student-info block (identity fields come from the User
// profile in production; these are the Section-A fields collected in the form).
const SI = (over = {}) => ({
  section: "BSIS-3A",
  age: 20,
  gender: "Prefer not to say",
  contactNumber: "0917 000 0000",
  ...over,
});

/**
 * @typedef {Object} ValidationCase
 * @property {string}   id            Stable case identifier (PA-01 …).
 * @property {string}   title         Short human label.
 * @property {string}   persona       Narrative for the team / counselor brief.
 * @property {{category:string, risk:string, note:string}} designTarget
 * @property {number[]} likertScores  8 scores (1–5) in the fixed order above.
 * @property {Object}   payload       Remaining pre-assessment fields.
 */

/** @type {ValidationCase[]} */
export const CASES = [
  {
    id: "PA-01",
    title: "Academic Burnout — High",
    persona:
      "3rd-year IS student carrying an overloaded semester. Exhausted by requirements, " +
      "grades slipping, some withdrawal from peers. Endorses most stressors 'Often'.",
    designTarget: {
      category: "Academic Burnout",
      risk: "High",
      note: "Exercises burnout rule (overwhelmed≥4 AND academicAffected≥4) + High via avg≥4.0.",
    },
    likertScores: [5, 4, 4, 4, 3, 3, 4, 5], // avg 4.00 → High; two 5s (<3) so not Critical
    payload: {
      studentInfo: SI(),
      purposeOfVisit: ["Academic Concerns", "Stress Management"],
      purposeOfVisitOther: "",
      concernCategories: ["Academic Burnout", "Time Management"],
      concernCategoryOther: "",
      concernDescription:
        "I can't keep up with all my requirements anymore. I feel drained every day and my grades are dropping no matter how hard I try.",
      concernDuration: "1–3 months",
      expectedAssistance: "Help managing my workload and study routine.",
      urgencyLevel: "High",
      consentGiven: true,
    },
  },
  {
    id: "PA-02",
    title: "Academic Concern — Moderate",
    persona:
      "Student feeling somewhat overwhelmed and behind, but not exhausted or in crisis. " +
      "Mild, manageable academic strain.",
    designTarget: {
      category: "Academic Concern",
      risk: "Moderate",
      note: "academicAffected=3 keeps it OUT of burnout; overwhelmed≥3 → Academic Concern; avg 2.625 → Moderate.",
    },
    likertScores: [4, 3, 3, 2, 2, 2, 2, 3], // avg 2.625 → Moderate
    payload: {
      studentInfo: SI({ section: "BSED-2B" }),
      purposeOfVisit: ["Academic Concerns"],
      purposeOfVisitOther: "",
      concernCategories: ["Poor Study Habits", "Time Management"],
      concernCategoryOther: "",
      concernDescription:
        "I sometimes feel behind in my subjects and I want to improve my study habits before it gets worse.",
      concernDuration: "Less than 1 month",
      expectedAssistance: "Study tips and time management advice.",
      urgencyLevel: "Moderate",
      consentGiven: true,
    },
  },
  {
    id: "PA-03",
    title: "Career Planning — Low",
    persona:
      "Otherwise-fine student who is simply unsure about their career direction. Low distress overall.",
    designTarget: {
      category: "Career Planning",
      risk: "Low",
      note: "career=4 → Career Planning; everything else low so avg 2.0 → Low.",
    },
    likertScores: [2, 2, 2, 1, 1, 4, 2, 2], // avg 2.00 → Low
    payload: {
      studentInfo: SI({ section: "BSIS-4A", age: 21 }),
      purposeOfVisit: ["Career Planning"],
      purposeOfVisitOther: "",
      concernCategories: ["Career Decision-Making"],
      concernCategoryOther: "",
      concernDescription:
        "I'm doing okay in school but I'm not sure if the path I'm on is right for me. I'd like advice on planning my career.",
      concernDuration: "1–3 months",
      expectedAssistance: "Guidance on choosing a career direction.",
      urgencyLevel: "Low",
      consentGiven: true,
    },
  },
  {
    id: "PA-04",
    title: "Family Concern — High",
    persona:
      "Student under heavy family stress (parents separating) that is spilling into mood and focus. " +
      "Broadly elevated distress.",
    designTarget: {
      category: "Family Concern",
      risk: "High",
      note: "family=5 (career<4) → Family Concern, checked before Social; avg 4.0 → High.",
    },
    likertScores: [4, 4, 4, 4, 5, 3, 5, 3], // avg 4.00 → High; two 5s so not Critical
    payload: {
      studentInfo: SI({ section: "ABIS-2A", gender: "Female" }),
      purposeOfVisit: ["Family Concerns", "Emotional or Mental Well-being"],
      purposeOfVisitOther: "",
      concernCategories: ["Family Conflict", "Separation of Parents", "Lack of Family Support"],
      concernCategoryOther: "",
      concernDescription:
        "Things at home have been really hard since my parents started separating. I feel unsupported and it's affecting how I cope day to day.",
      concernDuration: "4–6 months",
      expectedAssistance: "Someone to talk to about my family situation.",
      urgencyLevel: "High",
      consentGiven: true,
    },
  },
  {
    id: "PA-05",
    title: "Social/Relationship — Moderate",
    persona:
      "Student dealing with peer conflict and feeling on the outs with classmates. Moderate distress.",
    designTarget: {
      category: "Social/Relationship Concern",
      risk: "Moderate",
      note: "social=5 (family/career<4) → Social/Relationship; avg 2.625 → Moderate.",
    },
    likertScores: [2, 2, 3, 5, 2, 2, 3, 2], // avg 2.625 → Moderate
    payload: {
      studentInfo: SI({ section: "BHUMS-1A", age: 18 }),
      purposeOfVisit: ["Relationship Concerns"],
      purposeOfVisitOther: "",
      concernCategories: ["Peer Conflict", "Communication Difficulties"],
      concernCategoryOther: "",
      concernDescription:
        "I keep getting into conflict with my classmates and it's been stressing me out. I'm not sure how to handle it.",
      concernDuration: "1–3 months",
      expectedAssistance: "Advice on dealing with peer conflict.",
      urgencyLevel: "Moderate",
      consentGiven: true,
    },
  },
  {
    id: "PA-06",
    title: "Personal/Emotional — Moderate",
    persona:
      "Student reporting frequent anxiety and feeling isolated/unsupported, with low academic spillover. " +
      "Distress concentrated in the emotional domain.",
    designTarget: {
      category: "Personal/Emotional Concern",
      risk: "Moderate",
      note: "stressed=5 OR isolated=5 → Personal/Emotional; avg 3.25 → Moderate. (See doc: a purely emotional profile rarely reaches High by average — it tips straight to Critical via the 3×Always / Immediate rule.)",
    },
    likertScores: [3, 3, 5, 3, 2, 2, 5, 3], // avg 3.25 → Moderate; two 5s
    payload: {
      studentInfo: SI({ section: "BSIS-2A" }),
      purposeOfVisit: ["Emotional or Mental Well-being", "Personal Concerns"],
      purposeOfVisitOther: "",
      concernCategories: ["Anxiety", "Emotional Distress"],
      concernCategoryOther: "",
      concernDescription:
        "I feel anxious a lot of the time and like I have no one to lean on. It comes and goes but it's been wearing me down.",
      concernDuration: "1–3 months",
      expectedAssistance: "Coping strategies for anxiety.",
      urgencyLevel: "Moderate",
      consentGiven: true,
    },
  },
  {
    id: "PA-07",
    title: "Financial Concern — Low",
    persona:
      "Student whose main issue is financial/scholarship pressure; Likert distress is low across the board. " +
      "Category must come from the purpose/concern fallback, not the Likert tree.",
    designTarget: {
      category: "Financial Concern",
      risk: "Low",
      note: "All Likert low → falls through to purpose fallback (Financial/Scholarship) → Financial Concern; avg 1.75 → Low.",
    },
    likertScores: [2, 2, 2, 1, 1, 2, 2, 2], // avg 1.75 → Low
    payload: {
      studentInfo: SI({ section: "BECED-3A", age: 22 }),
      purposeOfVisit: ["Financial Concerns", "Scholarship Concerns"],
      purposeOfVisitOther: "",
      concernCategories: ["Financial Concerns"],
      concernCategoryOther: "",
      concernDescription:
        "I'm worried about affording my fees this term and whether my scholarship will be renewed. School itself is fine.",
      concernDuration: "Less than 1 month",
      expectedAssistance: "Information on financial aid options.",
      urgencyLevel: "Low",
      consentGiven: true,
    },
  },
  {
    id: "PA-08",
    title: "General Concern — Low",
    persona:
      "First-year still adjusting to college life; no specific domain stands out and the concern tags " +
      "don't map to a specialized category. Exercises the final General fallback.",
    designTarget: {
      category: "General Concern",
      risk: "Low",
      note: "All Likert low; purpose 'Adjustment to College Life' + concern 'Health Concerns' map to nothing → General Concern; avg 2.0 → Low.",
    },
    likertScores: [2, 2, 2, 2, 2, 2, 2, 2], // avg 2.00 → Low
    payload: {
      studentInfo: SI({ section: "BHUMS-1B", age: 18 }),
      purposeOfVisit: ["Adjustment to College Life"],
      purposeOfVisitOther: "",
      concernCategories: ["Health Concerns"],
      concernCategoryOther: "",
      concernDescription:
        "I'm still getting used to college and just wanted to check in with the guidance office about settling in.",
      concernDuration: "Less than 1 month",
      expectedAssistance: "General orientation and someone to talk to.",
      urgencyLevel: "Low",
      consentGiven: true,
    },
  },
  {
    id: "PA-09",
    title: "Critical via Immediate urgency",
    persona:
      "Student in acute emotional distress who self-flags the situation as needing urgent help. " +
      "Scores are only moderate, but the self-assessed Immediate urgency must force a Critical classification.",
    designTarget: {
      category: "Personal/Emotional Concern",
      risk: "Critical",
      note: "SAFETY PATH 1: urgencyLevel=Immediate → Critical regardless of average (avg here is only 2.875).",
    },
    likertScores: [3, 3, 4, 2, 2, 2, 4, 3], // avg 2.875 (Moderate by avg) → escalated to Critical by urgency
    payload: {
      studentInfo: SI({ section: "BSED-4A", age: 21, gender: "Female" }),
      purposeOfVisit: ["Emotional or Mental Well-being"],
      purposeOfVisitOther: "",
      concernCategories: ["Anxiety", "Emotional Distress"],
      concernCategoryOther: "",
      concernDescription:
        "I'm really not okay right now and I don't know how much longer I can handle this on my own. I need to talk to someone as soon as possible.",
      concernDuration: "Less than 1 month",
      expectedAssistance: "Urgent support — I need help soon.",
      urgencyLevel: "Immediate",
      consentGiven: true,
    },
  },
  {
    id: "PA-10",
    title: "Critical via 3× 'Always'",
    persona:
      "Student who marks three statements as 'Always' (5). Average alone would be Moderate and the student " +
      "rated urgency only High — the system must still escalate to Critical on the count of maxed-out items.",
    designTarget: {
      category: "Academic Burnout",
      risk: "Critical",
      note: "SAFETY PATH 2: ≥3 scores of 5 → Critical even though avg is 3.625 and urgency is only High.",
    },
    likertScores: [5, 4, 5, 2, 2, 2, 5, 4], // three 5s → Critical; burnout (overwhelmed≥4 & academicAffected≥4)
    payload: {
      studentInfo: SI({ section: "BSIS-4B", age: 22 }),
      purposeOfVisit: ["Academic Concerns", "Stress Management", "Emotional or Mental Well-being"],
      purposeOfVisitOther: "",
      concernCategories: ["Academic Burnout", "Stress"],
      concernCategoryOther: "",
      concernDescription:
        "Everything feels like too much all the time — the workload, the stress, feeling alone. It never lets up and it's hurting my grades.",
      concernDuration: "More than 6 months",
      expectedAssistance: "I need real help to get through this semester.",
      urgencyLevel: "High",
      consentGiven: true,
    },
  },
  {
    id: "PA-11",
    title: "Boundary — avg exactly 2.50 (Low/Moderate)",
    persona:
      "Deliberate threshold probe. Mild academic concern with an overall average that lands exactly on the " +
      "Low→Moderate cut line (2.5).",
    designTarget: {
      category: "Academic Concern",
      risk: "Moderate",
      note: "BOUNDARY: avg=2.50 must classify as Moderate (rule is avg≥2.5). Pair with PA-08 (avg 2.0 → Low).",
    },
    likertScores: [3, 3, 3, 2, 2, 2, 2, 3], // avg 2.50 exactly → Moderate
    payload: {
      studentInfo: SI({ section: "BSIS-1A", age: 19 }),
      purposeOfVisit: ["Academic Concerns"],
      purposeOfVisitOther: "",
      concernCategories: ["Low Grades"],
      concernCategoryOther: "",
      concernDescription:
        "My grades have dipped a little and I sometimes struggle to focus. I want to get back on track.",
      concernDuration: "1–3 months",
      expectedAssistance: "Academic support.",
      urgencyLevel: "Low",
      consentGiven: true,
    },
  },
  {
    id: "PA-12",
    title: "Boundary — avg 3.875 (just below High)",
    persona:
      "Deliberate threshold probe. A burnout pattern with several 'Often' answers and one 'Always', but an " +
      "average just under 4.0 — must remain Moderate, not High.",
    designTarget: {
      category: "Academic Burnout",
      risk: "Moderate",
      note: "BOUNDARY: same category as PA-01 but avg 3.875 (<4) and only one 5 → Moderate, proving High needs avg≥4 or 3×Always.",
    },
    likertScores: [4, 4, 4, 4, 3, 3, 4, 5], // avg 3.875 → Moderate; one 5
    payload: {
      studentInfo: SI({ section: "BSED-3B", age: 20 }),
      purposeOfVisit: ["Academic Concerns", "Stress Management"],
      purposeOfVisitOther: "",
      concernCategories: ["Academic Burnout", "Poor Study Habits"],
      concernCategoryOther: "",
      concernDescription:
        "I'm tired and stretched thin by school, and it's starting to show in my performance, but I'm still holding on.",
      concernDuration: "1–3 months",
      expectedAssistance: "Help before things get worse.",
      urgencyLevel: "Moderate",
      consentGiven: true,
    },
  },
];

/** Build the {statement, score} array the engine/API expects from an 8-number row. */
export function toLikertResponses(likertScores) {
  return likertScores.map((score, i) => ({ statement: LIKERT_STATEMENTS[i], score }));
}

export default CASES;

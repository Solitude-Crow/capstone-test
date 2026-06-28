/**
 * Recommendation Engine
 *
 * Queries RecommendationRule and Resource collections to produce
 * counselor-approved, deterministic suggestions without relying on Gemini.
 *
 * Fallback defaults are built in so the engine produces meaningful output
 * even on first run before any rules are seeded.
 */

import mongoose from "mongoose";
import RecommendationRule from "../models/recommendationRule.model.js";
import Resource from "../models/resource.model.js";
import logger from "../lib/logger.js";

// ── Built-in fallbacks (used when DB has no matching rules) ───────────────────
const FALLBACK_RULES = {
  "Academic Burnout": {
    High:     { nextAction: "Schedule a counseling session and discuss academic load management.", notes: "Student shows signs of academic burnout. Explore workload, study habits, and potential environmental stressors. Consider coordinating with faculty adviser." },
    Critical: { nextAction: "Immediate counseling session recommended.", notes: "Student is experiencing severe academic burnout. Prioritize emotional stabilization before academic concerns. Consider emergency leave options." },
    Moderate: { nextAction: "Schedule counseling and recommend study skills resources.", notes: "Student is struggling with academic demands. Introduce time management and study strategies." },
    Low:      { nextAction: "Recommend self-help academic resources.", notes: "Student experiencing mild academic concerns. Suggest study skill resources and monitor." },
  },
  "Academic Concern": {
    High:     { nextAction: "Schedule counseling session focused on academic support.", notes: "Student has significant academic difficulties. Explore root causes — attendance, learning difficulties, or external stressors." },
    Critical: { nextAction: "Immediate counseling and possible faculty coordination.", notes: "Academic issues are severe. Coordinate with faculty and explore remediation options." },
    Moderate: { nextAction: "Recommend academic support resources and schedule follow-up.", notes: "Student has moderate academic challenges. Connect with tutoring and academic advising." },
    Low:      { nextAction: "Provide academic resource referrals.", notes: "Student has mild academic concerns. Recommend study skills resources." },
  },
  "Career Planning": {
    Any:      { nextAction: "Schedule a career guidance counseling session.", notes: "Student is uncertain about career direction. Explore interests, strengths, and program alignment. Consider career assessment tools." },
  },
  "Family Concern": {
    High:     { nextAction: "Schedule counseling session with family-focused approach.", notes: "Student has significant family stressors. Build rapport and explore impact on daily functioning. Consider referral to family counseling services." },
    Critical: { nextAction: "Immediate counseling session — assess safety and support needs.", notes: "Student reports severe family concerns. Assess for safety concerns and available support network." },
    Moderate: { nextAction: "Schedule counseling session and provide family support resources.", notes: "Family concerns are affecting the student. Explore coping strategies and available support." },
    Low:      { nextAction: "Provide family support resources and offer counseling.", notes: "Student has family concerns. Offer a listening ear and relevant resources." },
  },
  "Social/Relationship Concern": {
    Any:      { nextAction: "Schedule counseling session focused on interpersonal skills and support.", notes: "Student reports social or relationship difficulties. Explore social dynamics and communication patterns. Peer conflict or isolation may be involved." },
  },
  "Personal/Emotional Concern": {
    High:     { nextAction: "Schedule counseling session promptly — within 48 hours.", notes: "Student shows high emotional distress. Assess coping capacity and safety. Provide immediate grounding strategies if needed." },
    Critical: { nextAction: "Immediate counseling session — assess crisis indicators.", notes: "Student reports severe emotional distress. Screen for crisis indicators. Ensure safety and connect with appropriate support." },
    Moderate: { nextAction: "Schedule counseling session and recommend stress management resources.", notes: "Student is experiencing emotional concerns. Explore triggers and build coping strategies." },
    Low:      { nextAction: "Recommend wellness resources and offer counseling.", notes: "Student has mild emotional concerns. Provide psychoeducation on stress management." },
  },
  "Financial Concern": {
    Any:      { nextAction: "Schedule counseling and provide financial assistance referrals.", notes: "Student has financial difficulties. Connect with financial aid office and scholarship resources. Explore impact on academic performance." },
  },
  "General Concern": {
    Any:      { nextAction: "Schedule an initial counseling session to explore concerns.", notes: "Student has general concerns. Begin with open-ended exploration to identify the primary area of need." },
  },
};

// ── Fallback resource titles by category/risk ─────────────────────────────────
const FALLBACK_RESOURCES = {
  "Academic Burnout": [
    { title: "Study Skills Workshop", description: "Develop effective study habits and academic strategies.", type: "workshop", category: "Academic" },
    { title: "Time Management Seminar", description: "Learn prioritization and scheduling techniques for students.", type: "seminar", category: "Academic" },
    { title: "Guidance Counseling Session", description: "One-on-one session with a guidance counselor.", type: "session", category: "General" },
  ],
  "Academic Concern": [
    { title: "Study Skills Workshop", description: "Develop effective study habits and academic strategies.", type: "workshop", category: "Academic" },
    { title: "Peer Tutoring Program", description: "Academic support from trained peer tutors.", type: "program", category: "Academic" },
    { title: "Guidance Counseling Session", description: "One-on-one session with a guidance counselor.", type: "session", category: "General" },
  ],
  "Career Planning": [
    { title: "Career Planning Seminar", description: "Explore career paths, skills alignment, and future planning.", type: "seminar", category: "Career" },
    { title: "Guidance Counseling Session", description: "One-on-one career guidance with a counselor.", type: "session", category: "General" },
  ],
  "Family Concern": [
    { title: "Family Counseling Referral", description: "Referral to family counseling services for deeper support.", type: "referral", category: "Family" },
    { title: "Guidance Counseling Session", description: "One-on-one session with a guidance counselor.", type: "session", category: "General" },
  ],
  "Social/Relationship Concern": [
    { title: "Social Skills Workshop", description: "Build interpersonal communication and conflict resolution skills.", type: "workshop", category: "Social/Relationship" },
    { title: "Guidance Counseling Session", description: "One-on-one session with a guidance counselor.", type: "session", category: "General" },
  ],
  "Personal/Emotional Concern": [
    { title: "Stress Management Webinar", description: "Practical techniques for managing stress and emotional well-being.", type: "webinar", category: "Personal/Emotional" },
    { title: "Mental Health Awareness Session", description: "Psychoeducation on mental health, coping, and self-care.", type: "seminar", category: "Personal/Emotional" },
    { title: "Guidance Counseling Session", description: "One-on-one session with a guidance counselor.", type: "session", category: "General" },
  ],
  "Financial Concern": [
    { title: "Financial Aid Office Referral", description: "Connect with the school's financial aid and scholarship office.", type: "referral", category: "Financial" },
    { title: "Guidance Counseling Session", description: "One-on-one session to discuss financial impact on studies.", type: "session", category: "General" },
  ],
  "General Concern": [
    { title: "Guidance Counseling Session", description: "One-on-one session with a guidance counselor.", type: "session", category: "General" },
  ],
};

// ── Normalize risk level for fallback lookup ───────────────────────────────────
function normalizeFallbackRisk(riskLevel, ruleMap) {
  if (ruleMap[riskLevel]) return riskLevel;
  if (ruleMap["Any"]) return "Any";
  // Pick closest
  if (riskLevel === "Critical" && ruleMap["High"]) return "High";
  if (riskLevel === "High" && ruleMap["Critical"]) return "Critical";
  if (riskLevel === "Moderate" && ruleMap["High"]) return "High";
  return Object.keys(ruleMap)[0] || "Any";
}

// ── Main export ────────────────────────────────────────────────────────────────
/**
 * @param {{ detectedCategory: string, riskLevel: string, purposeOfVisit: string[] }} params
 * @returns {Promise<{ suggestedResources, suggestedNextAction, counselorPreparationNotes }>}
 */
export async function generateRecommendations({ detectedCategory, riskLevel, purposeOfVisit = [] }) {
  try {
    // 1. Fetch all active rules for this category, then rank in JS.
    //    Done in JS (not via a $or query) so we avoid the sanitizeFilter
    //    wrapping issue, and so we still pick the closest rule even when an
    //    exact risk-level rule has not been seeded for this category.
    const categoryRules = await RecommendationRule.find({
      concernCategory: detectedCategory,
      active: true,
    })
      .populate("recommendedResources")
      .lean();

    if (categoryRules.length > 0) {
      // Prefer an exact risk match, then an "Any" rule, then anything;
      // break ties by the rule's own priority.
      const rankRule = (rule) => {
        let score = rule.priority || 0;
        if (rule.riskLevel === riskLevel) score += 1000;
        else if (rule.riskLevel === "Any") score += 500;
        return score;
      };
      const rule = [...categoryRules].sort((a, b) => rankRule(b) - rankRule(a))[0];

      const resources = (rule.recommendedResources || [])
        .filter((r) => r && r.active !== false)
        .map((r) => ({
          title:       r.title,
          description: r.description,
          type:        r.type,
          category:    r.category,
        }));

      // Only use the DB rule if it actually carries useful content; otherwise
      // fall through to resource matching / built-in defaults below.
      if (resources.length > 0 || rule.nextAction) {
        return {
          suggestedResources:        resources,
          suggestedNextAction:       rule.nextAction || "Schedule a counseling session.",
          counselorPreparationNotes: rule.counselorPreparationNotes || "",
        };
      }
    }

    // 2. Try to match resources from DB by category tags.
    //    NOTE: $in must be wrapped in mongoose.trusted() because db.js sets
    //    sanitizeFilter:true, which would otherwise wrap it in $eq and break it.
    const dbResources = await Resource.find({
      category: mongoose.trusted({ $in: [detectedCategory.split(" ")[0], "General"] }),
      active: true,
    })
      .limit(3)
      .lean();

    if (dbResources.length > 0) {
      const fallbackRule = FALLBACK_RULES[detectedCategory] || FALLBACK_RULES["General Concern"];
      const key = normalizeFallbackRisk(riskLevel, fallbackRule);
      const ruleData = fallbackRule[key] || fallbackRule["Any"] || {};

      return {
        suggestedResources: dbResources.map((r) => ({
          title:       r.title,
          description: r.description,
          type:        r.type,
          category:    r.category,
        })),
        suggestedNextAction:       ruleData.nextAction || "Schedule a counseling session.",
        counselorPreparationNotes: ruleData.notes || "",
      };
    }

    // 3. Full fallback — use built-in defaults
    const fallbackRule = FALLBACK_RULES[detectedCategory] || FALLBACK_RULES["General Concern"];
    const key = normalizeFallbackRisk(riskLevel, fallbackRule);
    const ruleData = fallbackRule[key] || fallbackRule["Any"] || {};
    const resources = FALLBACK_RESOURCES[detectedCategory] || FALLBACK_RESOURCES["General Concern"];

    return {
      suggestedResources:        resources.slice(0, 3),
      suggestedNextAction:       ruleData.nextAction || "Schedule a counseling session.",
      counselorPreparationNotes: ruleData.notes || "",
    };
  } catch (err) {
    logger.error("recommendationEngine error:", { error: err.message });

    // Hard fallback — never fail silently
    return {
      suggestedResources: [
        {
          title:       "Guidance Counseling Session",
          description: "One-on-one session with a guidance counselor.",
          type:        "session",
          category:    "General",
        },
      ],
      suggestedNextAction:       "Schedule a counseling session.",
      counselorPreparationNotes: "Review student responses before the session.",
    };
  }
}

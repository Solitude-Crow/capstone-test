/**
 * Seed Script: Guidance Knowledge Base
 *
 * Populates the Resource and RecommendationRule collections with initial
 * counselor-approved data so the rule-based engine produces useful results
 * on first run.
 *
 * Run: node src/scripts/seedGuidanceData.js
 * (from the backend/ directory with MONGODB_URI in .env)
 */

import "dotenv/config";
import mongoose from "mongoose";
import Resource from "../models/resource.model.js";
import RecommendationRule from "../models/recommendationRule.model.js";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

// ── Resources ─────────────────────────────────────────────────────────────────
const RESOURCES = [
  {
    title: "Study Skills Workshop",
    description: "An interactive workshop to help students develop effective study habits, note-taking strategies, and exam preparation techniques.",
    category: "Academic",
    concernTags: ["Academic Burnout", "Poor Study Habits", "Difficulty Concentrating", "Low Grades"],
    type: "workshop",
    audience: ["students"],
  },
  {
    title: "Time Management Seminar",
    description: "A seminar on prioritization, scheduling, and productivity tools to help students manage academic workloads effectively.",
    category: "Academic",
    concernTags: ["Academic Burnout", "Time Management", "Attendance Issues", "Overwhelmed"],
    type: "seminar",
    audience: ["students"],
  },
  {
    title: "Peer Tutoring Program",
    description: "Free academic support provided by trained senior student tutors across various subject areas.",
    category: "Academic",
    concernTags: ["Low Grades", "Difficulty Understanding Lessons", "Academic Concern"],
    type: "program",
    audience: ["students"],
  },
  {
    title: "Stress Management Webinar",
    description: "Practical, evidence-based techniques for managing stress and anxiety, including breathing exercises, mindfulness, and relaxation strategies.",
    category: "Personal/Emotional",
    concernTags: ["Stress", "Anxiety", "Emotional Distress", "Overwhelmed"],
    type: "webinar",
    audience: ["students"],
  },
  {
    title: "Mental Health Awareness Session",
    description: "A psychoeducation session covering mental health basics, emotional coping strategies, and when to seek professional help.",
    category: "Personal/Emotional",
    concernTags: ["Anxiety", "Low Self-Esteem", "Motivation Issues", "Self-Confidence Issues"],
    type: "seminar",
    audience: ["students"],
  },
  {
    title: "Social Skills Workshop",
    description: "Builds interpersonal communication, active listening, conflict resolution, and assertiveness skills for healthier relationships.",
    category: "Social/Relationship",
    concernTags: ["Peer Conflict", "Bullying", "Social Anxiety", "Communication Difficulties"],
    type: "workshop",
    audience: ["students"],
  },
  {
    title: "Career Planning Seminar",
    description: "Helps students explore career paths, align them with their program and strengths, and plan for professional development.",
    category: "Career",
    concernTags: ["Career Decision-Making", "Course Shifting Concerns", "Employment Preparation"],
    type: "seminar",
    audience: ["students"],
  },
  {
    title: "Family Counseling Referral",
    description: "Referral to qualified family counseling services for students experiencing significant family-related concerns.",
    category: "Family",
    concernTags: ["Family Conflict", "Separation of Parents", "Lack of Family Support"],
    type: "referral",
    audience: ["students"],
  },
  {
    title: "Financial Aid Office Referral",
    description: "Connect with the school's Financial Aid and Scholarship Office for financial assistance programs, emergency funds, and scholarship opportunities.",
    category: "Financial",
    concernTags: ["Financial Difficulties", "Financial Concerns", "Scholarship Concerns"],
    type: "referral",
    audience: ["students"],
  },
  {
    title: "Guidance Counseling Session",
    description: "One-on-one counseling session with a licensed guidance counselor to discuss personal, academic, or emotional concerns in a confidential setting.",
    category: "General",
    concernTags: ["General", "All"],
    type: "session",
    audience: ["students"],
  },
  {
    title: "Internship and Career Readiness Program",
    description: "Guidance on internship applications, workplace readiness, resume building, and interview preparation.",
    category: "Career",
    concernTags: ["Internship Concerns", "Employment Preparation", "Career Decision-Making"],
    type: "program",
    audience: ["students"],
  },
];

// ── Rules (inserted after resources so we can reference their IDs) ────────────
async function buildRules(resourceMap) {
  const r = (title) => resourceMap[title]?._id;

  return [
    // Academic Burnout
    {
      ruleName: "Academic Burnout — Critical",
      concernCategory: "Academic Burnout",
      riskLevel: "Critical",
      conditions: { urgencyLevels: ["Immediate", "Crisis"] },
      recommendedResources: [r("Guidance Counseling Session"), r("Study Skills Workshop"), r("Time Management Seminar")].filter(Boolean),
      nextAction: "Schedule an immediate counseling session. Prioritize emotional stabilization before addressing academic concerns. Coordinate with faculty adviser if academic leave may be warranted.",
      counselorPreparationNotes: "Student shows critical academic burnout indicators. Begin with validation and safety assessment. Explore the scope of academic demands and any concurrent life stressors. Consider discussing academic load reduction or leave options with faculty.",
      priority: 10,
    },
    {
      ruleName: "Academic Burnout — High",
      concernCategory: "Academic Burnout",
      riskLevel: "High",
      recommendedResources: [r("Study Skills Workshop"), r("Time Management Seminar"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule counseling session within 48 hours. Introduce study skills and time management resources as complementary support.",
      counselorPreparationNotes: "Student is experiencing significant academic burnout. Explore workload, study habits, sleep, and environmental stressors. Introduce coping strategies and academic support resources early in the session.",
      priority: 9,
    },
    {
      ruleName: "Academic Burnout — Moderate",
      concernCategory: "Academic Burnout",
      riskLevel: "Moderate",
      recommendedResources: [r("Study Skills Workshop"), r("Time Management Seminar"), r("Peer Tutoring Program")].filter(Boolean),
      nextAction: "Recommend study skills and time management resources. Schedule counseling within the week.",
      counselorPreparationNotes: "Student is struggling with academic demands. Focus on practical strategies for workload management. Introduce peer tutoring if academic performance is declining.",
      priority: 8,
    },
    {
      ruleName: "Academic Burnout — Low",
      concernCategory: "Academic Burnout",
      riskLevel: "Low",
      recommendedResources: [r("Study Skills Workshop"), r("Time Management Seminar")].filter(Boolean),
      nextAction: "Recommend self-help academic resources and schedule a follow-up if needed.",
      counselorPreparationNotes: "Mild academic strain detected. Preventive resources may reduce risk of escalation.",
      priority: 7,
    },

    // Academic Concern
    {
      ruleName: "Academic Concern — High/Critical",
      concernCategory: "Academic Concern",
      riskLevel: "High",
      recommendedResources: [r("Peer Tutoring Program"), r("Study Skills Workshop"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule counseling session and connect student with academic support resources.",
      counselorPreparationNotes: "Student has significant academic difficulties. Explore root causes — learning style, attendance, health, or external stressors. Coordinate with faculty adviser if academic standing is at risk.",
      priority: 7,
    },
    {
      ruleName: "Academic Concern — Moderate/Low",
      concernCategory: "Academic Concern",
      riskLevel: "Moderate",
      recommendedResources: [r("Peer Tutoring Program"), r("Study Skills Workshop")].filter(Boolean),
      nextAction: "Connect student with tutoring and study skill resources.",
      counselorPreparationNotes: "Student has moderate academic challenges. Reinforce academic support systems and monitor progress.",
      priority: 6,
    },

    // Career Planning
    {
      ruleName: "Career Planning — Any",
      concernCategory: "Career Planning",
      riskLevel: "Any",
      recommendedResources: [r("Career Planning Seminar"), r("Internship and Career Readiness Program"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule a career guidance counseling session. Explore student interests, strengths, and program alignment.",
      counselorPreparationNotes: "Student is uncertain about career direction. Use strength-based exploration and career interest tools. Explore whether course shifting or program clarification may be needed.",
      priority: 7,
    },

    // Family Concern
    {
      ruleName: "Family Concern — Critical",
      concernCategory: "Family Concern",
      riskLevel: "Critical",
      conditions: { urgencyLevels: ["Immediate", "Crisis"] },
      recommendedResources: [r("Guidance Counseling Session"), r("Family Counseling Referral")].filter(Boolean),
      nextAction: "Schedule an immediate counseling session. Assess safety, support network, and impact on daily functioning.",
      counselorPreparationNotes: "Student reports severe family concerns. Assess for safety considerations and available support. Consider referral to family counseling services and explore emergency support options.",
      priority: 10,
    },
    {
      ruleName: "Family Concern — High",
      concernCategory: "Family Concern",
      riskLevel: "High",
      recommendedResources: [r("Family Counseling Referral"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule counseling session within 48 hours. Consider family counseling referral.",
      counselorPreparationNotes: "Student has significant family stressors. Build rapport first. Explore impact on academic performance and well-being. Referral to family counseling services may be appropriate.",
      priority: 9,
    },
    {
      ruleName: "Family Concern — Moderate/Low",
      concernCategory: "Family Concern",
      riskLevel: "Moderate",
      recommendedResources: [r("Guidance Counseling Session"), r("Family Counseling Referral")].filter(Boolean),
      nextAction: "Schedule counseling session and explore available family support resources.",
      counselorPreparationNotes: "Family concerns are affecting the student. Explore coping strategies and build resilience. Provide referral information for family counseling.",
      priority: 7,
    },

    // Social/Relationship Concern
    {
      ruleName: "Social/Relationship Concern — Any",
      concernCategory: "Social/Relationship Concern",
      riskLevel: "Any",
      recommendedResources: [r("Social Skills Workshop"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule counseling session focused on interpersonal concerns. Recommend social skills workshop.",
      counselorPreparationNotes: "Student reports social or relationship difficulties. Explore peer dynamics, communication patterns, and any conflict or isolation. Social skills workshop may complement counseling.",
      priority: 7,
    },

    // Personal/Emotional Concern
    {
      ruleName: "Personal/Emotional Concern — Critical",
      concernCategory: "Personal/Emotional Concern",
      riskLevel: "Critical",
      conditions: { urgencyLevels: ["Immediate", "Crisis"] },
      recommendedResources: [r("Guidance Counseling Session"), r("Stress Management Webinar")].filter(Boolean),
      nextAction: "Immediate counseling session required. Screen for crisis indicators and assess safety.",
      counselorPreparationNotes: "Student reports severe emotional distress. Screen for crisis indicators (self-harm, suicidal ideation) at session start. Ensure safety plan and immediate support access. Use grounding techniques if necessary.",
      priority: 10,
    },
    {
      ruleName: "Personal/Emotional Concern — High",
      concernCategory: "Personal/Emotional Concern",
      riskLevel: "High",
      recommendedResources: [r("Stress Management Webinar"), r("Mental Health Awareness Session"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule counseling session within 48 hours. Provide stress management and mental health resources.",
      counselorPreparationNotes: "Student shows high emotional distress. Assess coping capacity and daily functioning. Introduce evidence-based stress reduction strategies. Explore triggers and support network.",
      priority: 9,
    },
    {
      ruleName: "Personal/Emotional Concern — Moderate",
      concernCategory: "Personal/Emotional Concern",
      riskLevel: "Moderate",
      recommendedResources: [r("Stress Management Webinar"), r("Mental Health Awareness Session")].filter(Boolean),
      nextAction: "Recommend wellness resources and schedule counseling.",
      counselorPreparationNotes: "Student is experiencing moderate emotional difficulties. Provide psychoeducation on stress and coping. Encourage use of wellness resources.",
      priority: 7,
    },
    {
      ruleName: "Personal/Emotional Concern — Low",
      concernCategory: "Personal/Emotional Concern",
      riskLevel: "Low",
      recommendedResources: [r("Stress Management Webinar")].filter(Boolean),
      nextAction: "Recommend wellness and self-care resources. Offer counseling if needed.",
      counselorPreparationNotes: "Mild emotional concerns. Preventive intervention and psychoeducation are appropriate.",
      priority: 5,
    },

    // Financial Concern
    {
      ruleName: "Financial Concern — Any",
      concernCategory: "Financial Concern",
      riskLevel: "Any",
      recommendedResources: [r("Financial Aid Office Referral"), r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Connect student with Financial Aid Office. Schedule counseling to discuss academic impact.",
      counselorPreparationNotes: "Student has financial difficulties. Connect with financial aid and scholarship resources. Explore impact on academic performance and mental health. Advocacy with relevant offices may be needed.",
      priority: 7,
    },

    // General Concern
    {
      ruleName: "General Concern — Any",
      concernCategory: "General Concern",
      riskLevel: "Any",
      recommendedResources: [r("Guidance Counseling Session")].filter(Boolean),
      nextAction: "Schedule an initial counseling session to explore the student's concerns.",
      counselorPreparationNotes: "Begin with open-ended exploration to identify the student's primary area of need. Use active listening to help the student articulate their concerns.",
      priority: 1,
    },
  ];
}

// ── Seed runner ───────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Clear existing seed data
  await Resource.deleteMany({});
  await RecommendationRule.deleteMany({});
  console.log("Cleared existing Resources and RecommendationRules");

  // Insert resources
  const inserted = await Resource.insertMany(RESOURCES);
  const resourceMap = {};
  inserted.forEach((r) => { resourceMap[r.title] = r; });
  console.log(`Inserted ${inserted.length} Resources`);

  // Insert rules
  const rules = await buildRules(resourceMap);
  const insertedRules = await RecommendationRule.insertMany(rules);
  console.log(`Inserted ${insertedRules.length} RecommendationRules`);

  await mongoose.disconnect();
  console.log("Done. Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

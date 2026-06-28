// services/ai.js
/**
 * AI Service for Pre-Assessment Recommendations
 *
 * Uses Google Gemini API (free tier via Google AI Studio).
 * Model fallback chain (tried in order, each has its own quota bucket):
 *   1. GEMINI_MODEL env var (if set)
 *   2. gemini-2.0-flash
 *   3. gemini-2.0-flash-lite
 *
 * Per-assessment request count: exactly 1 Gemini API call is made per
 * pre-assessment submission. The "7 requests / 0% success" you see in
 * Google Studio = 7 pre-assessment submissions that all hit quota.
 * With MAX_RETRIES=2, a single submission can make up to 3 HTTP calls,
 * but each retry is still counted as a separate request in the dashboard.
 *
 * Recommended action types:
 *   "book_appointment"   — concern needs professional counseling
 *   "self_help"          — manageable with reading materials / self-guided tools
 *   "external_referral"  — needs specialist / hotline / external service
 *   "monitor_self"       — low concern, student should self-monitor for now
 */
import logger from "../lib/logger.js";

// ── Shared prompt builder ─────────────────────────────────────────────────────
const buildPrompt = (assessmentData) => {
  const questionsBlock =
    assessmentData.responses?.length
      ? `\nQUESTIONNAIRE RESPONSES:\n${assessmentData.responses
          .map((r) => `Q: ${r.question}\nA: ${r.answer}`)
          .join("\n\n")}`
      : "";

  return `You are a professional guidance counselor assistant at a university in the Philippines. A student has submitted a pre-assessment form. Analyze the information and produce two things: (1) structured guidance for the counselor, and (2) a student-facing recommendation.

PRIMARY CONCERN: ${assessmentData.primaryConcern}
URGENCY LEVEL: ${assessmentData.urgencyLevel}

STUDENT'S DESCRIPTION OF CONCERN:
${assessmentData.concernDescription}
${questionsBlock}

Respond ONLY with a valid JSON object using exactly this structure — no markdown, no extra text:
{
  "summary": "A 2-3 sentence empathetic summary of the student's concern",
  "category": "One of: Academic, Personal/Emotional, Career, Family, Social/Interpersonal, Financial, Health/Wellness, Crisis",
  "interventions": ["3 to 5 specific and actionable interventions the counselor should consider"],
  "urgencyFlag": false,
  "counselorTips": "1-2 practical sentences on how the counselor should open and approach this session",
  "recommendedAction": "one of: book_appointment | self_help | external_referral | monitor_self",
  "studentFacingMessage": "A warm, empathetic 2-3 sentence message addressed directly to the student explaining what the AI recommends and why. Use 'you' and be encouraging.",
  "studentResources": [
    {
      "title": "Resource name",
      "description": "One sentence on how this helps the student",
      "link": ""
    }
  ]
}

RULES FOR recommendedAction:
- Use "book_appointment" if urgencyLevel is High or Crisis, OR if the concern is deeply personal/emotional/family and needs professional support.
- Use "self_help" if urgencyLevel is Low or Moderate AND the concern is Academic, Career, or a manageable personal issue with clear self-help resources available.
- Use "external_referral" if the concern involves mental health crisis, substance use, financial hardship needing institutional support, or health issues needing medical attention.
- Use "monitor_self" if urgencyLevel is Low AND the concern is minor and situational — student just needs to track their own progress.

RULES FOR studentResources (provide 2-4 items):
- For "self_help": suggest specific reading topics, academic strategies, or wellness techniques with descriptive titles.
- For "external_referral": suggest specific Philippine hotlines (e.g. Hopeline PH 02-8804-4673, iCall), student services offices, or health referral paths. Leave link blank unless you are certain of the URL.
- For "monitor_self": suggest simple journaling prompts, mood tracking habits, or check-in questions.
- For "book_appointment": suggest 1-2 things the student can do to prepare for their counseling session (e.g. writing down their thoughts, bringing relevant documents).

Set urgencyFlag to true ONLY if the submission shows clear signs of crisis, self-harm risk, suicidal ideation, or immediate danger to self or others.`;
};

// ── Parse AI response safely ──────────────────────────────────────────────────
const VALID_ACTIONS = ["book_appointment", "self_help", "external_referral", "monitor_self"];

const parseAIResponse = (rawText, primaryConcern) => {
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  const resources = Array.isArray(parsed.studentResources)
    ? parsed.studentResources.slice(0, 4).map((r) => ({
        title:       typeof r.title       === "string" ? r.title       : "",
        description: typeof r.description === "string" ? r.description : "",
        link:        typeof r.link        === "string" ? r.link        : "",
      }))
    : [];

  return {
    summary:              typeof parsed.summary              === "string" ? parsed.summary              : "",
    category:             typeof parsed.category             === "string" ? parsed.category             : primaryConcern,
    interventions:        Array.isArray(parsed.interventions) ? parsed.interventions.slice(0, 6) : [],
    urgencyFlag:          Boolean(parsed.urgencyFlag),
    counselorTips:        typeof parsed.counselorTips        === "string" ? parsed.counselorTips        : "",
    recommendedAction:    VALID_ACTIONS.includes(parsed.recommendedAction) ? parsed.recommendedAction : "book_appointment",
    studentFacingMessage: typeof parsed.studentFacingMessage === "string" ? parsed.studentFacingMessage : "",
    studentResources:     resources,
    generatedAt:          new Date(),
  };
};

// ── Sleep helper ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Extract Retry-After milliseconds from a Gemini 429 body ──────────────────
const extractRetryAfterMs = (errorBody) => {
  try {
    const parsed = typeof errorBody === "string" ? JSON.parse(errorBody) : errorBody;
    const retryDelay = parsed?.error?.details?.find(
      (d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
    )?.retryDelay;
    if (retryDelay) {
      // retryDelay is a string like "43s", "43.961568381s", or "0s"
      const seconds = parseFloat(retryDelay.replace("s", ""));
      if (!isNaN(seconds) && seconds > 0) return Math.ceil(seconds) * 1000;
    }
  } catch (_) { /* ignore parse errors */ }
  return null;
};

// ── Per-model daily quota guard ───────────────────────────────────────────────
// Tracks timestamp (ms) until which a model's daily quota is considered
// exhausted. Resets to null once that time passes.
const quotaExhaustedUntil = {};

const isModelQuotaExhausted = (model) => {
  const until = quotaExhaustedUntil[model];
  if (!until) return false;
  if (Date.now() >= until) {
    quotaExhaustedUntil[model] = null; // reset after cooldown
    return false;
  }
  return true;
};

const markModelQuotaExhausted = (model) => {
  // Lock out for 1 hour — free-tier daily limits reset at midnight PT,
  // but per-minute limits recover sooner. 1h is a safe middle ground.
  quotaExhaustedUntil[model] = Date.now() + 60 * 60 * 1000;
  logger.warn(`Model ${model} daily quota exhausted. Locked out for 1 hour.`);
};

// ── Single-model attempt with retries ────────────────────────────────────────
const MAX_RETRIES = 2; // up to 3 total attempts per model

const tryModel = async (apiKey, model, assessmentData) => {
  if (isModelQuotaExhausted(model)) {
    logger.warn(`Skipping ${model} — daily quota guard active.`);
    return null; // signal: skip this model
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: buildPrompt(assessmentData) }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const controller = new AbortController();
    // 55s per-attempt timeout — stays inside the 60s axios client timeout
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) {
      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error(`${model} returned empty content`);
      const result = parseAIResponse(rawText, assessmentData.primaryConcern);
      return { ...result, provider: "gemini", model, rawResponse: rawText };
    }

    const errorText = await response.text();

    if (response.status === 429) {
      // Check whether this is a daily quota exhaustion or just a per-minute
      // rate limit. Daily exhaustion = retrying here won't help.
      const isDailyQuota = errorText.includes("GenerateRequestsPerDayPerProjectPerModel");

      if (isDailyQuota) {
        // Mark quota exhausted so future submissions skip this model quickly.
        markModelQuotaExhausted(model);
        // Return null to signal the caller to try the next model.
        return null;
      }

      // Per-minute rate limit — retry with backoff if attempts remain.
      if (attempt < MAX_RETRIES) {
        attempt++; // increment FIRST so backoff uses the correct value
        const waitMs =
          extractRetryAfterMs(errorText) ??
          Math.min(5000 * 2 ** attempt, 60000);
        logger.warn(
          `${model} 429 per-minute limit (attempt ${attempt}/${MAX_RETRIES + 1}). Retrying in ${waitMs}ms…`
        );
        await sleep(waitMs);
        continue;
      }

      // Out of retries on per-minute limit — give up on this model.
      markModelQuotaExhausted(model);
      return null;
    }

    // Any other HTTP error — propagate up.
    throw new Error(`Gemini API error ${response.status} (${model}): ${errorText}`);
  }

  // Should be unreachable, but guard just in case.
  return null;
};

// ── Main Gemini function with model fallback chain ────────────────────────────
/**
 * MODEL SELECTION & FALLBACK:
 *
 * Each Gemini model has a completely separate free-tier quota bucket.
 * When the primary model is exhausted, we automatically fall back to the
 * next one. This effectively multiplies your daily free capacity.
 *
 * Priority:
 *   1. GEMINI_MODEL env var (if set) — tried first, no fallback beyond it
 *   2. gemini-2.0-flash             — 1,500 req/day free tier
 *   3. gemini-2.0-flash-lite        — separate 1,500 req/day free tier
 *
 * To use only a specific model, set GEMINI_MODEL in your .env.
 * To use the automatic fallback chain, leave GEMINI_MODEL unset.
 */
const generateWithGemini = async (assessmentData) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn("GEMINI_API_KEY not set – skipping AI recommendations");
    return null;
  }

  // Build the model list to try in order.
  const envModel = process.env.GEMINI_MODEL;
  const modelChain = envModel
    ? [envModel] // respect explicit override; no fallback
    : ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

  for (const model of modelChain) {
    try {
      logger.info(`Trying AI model: ${model}`);
      const result = await tryModel(apiKey, model, assessmentData);
      if (result !== null) {
        // Successful response
        return result;
      }
      // null = quota exhausted for this model, try next
      logger.info(`${model} quota exhausted — trying next model in chain…`);
    } catch (err) {
      // Non-quota error (network, parse, etc.) — log and try next model.
      logger.error(`${model} failed with non-quota error: ${err.message}`);
    }
  }

  // All models exhausted or failed.
  logger.error("All models in fallback chain failed or are quota-exhausted.");
  return null;
};

// ── Summary-only prompt for the enhanced pipeline ────────────────────────────
// Gemini now only generates student/counselor-friendly explanations.
// Category, risk level, and resources are determined by the rule-based engine.
const buildSummaryPrompt = ({ detectedCategory, riskLevel, riskFactors = [], selectedResources = [] }) => {
  const factorsList = riskFactors.length > 0
    ? riskFactors.map((f) => `- ${f}`).join("\n")
    : "- No specific high-score factors identified";

  const resourceList = selectedResources.length > 0
    ? selectedResources.map((r) => `- ${r.title}: ${r.description}`).join("\n")
    : "- Guidance Counseling Session";

  return `You are a compassionate guidance counselor assistant in a Philippine university. A student completed a pre-assessment form. The assessment system has already determined the following (do NOT change these values):

DETECTED CONCERN AREA: ${detectedCategory}
RISK LEVEL: ${riskLevel}
IDENTIFIED CONCERN INDICATORS:
${factorsList}

SUGGESTED RESOURCES (already chosen by the system):
${resourceList}

Your ONLY task is to generate two short, empathetic summaries based on the above. Respond ONLY with valid JSON — no markdown, no extra text:

{
  "studentSummary": "2-3 warm, encouraging sentences addressed directly to the student (use 'you'). Acknowledge their concern area, affirm that reaching out is a positive step, and gently note that the guidance office is ready to help. Use suggestive language like 'may indicate', 'appears to suggest', 'you may benefit from'. Do NOT diagnose or make definitive statements. Do NOT mention risk level by name.",
  "counselorSummary": "2-3 professional sentences for the guidance counselor. Briefly describe the concern area and key indicators from a professional lens. Use hedged language like 'responses suggest', 'may warrant', 'preliminary indicators'. Remind that this is preliminary support information and counselor judgment is primary."
}

IMPORTANT RULES:
- Use suggestive language only: "may indicate", "appears to suggest", "responses suggest", "you may benefit from"
- Do NOT say the student "has" a condition, disorder, or diagnosis
- Do NOT use words like "suffering from", "diagnosed", "requires treatment"
- Student summary must be warm, non-alarming, and encouraging
- Counselor summary must be professional and appropriately hedged`;
};

// ── Parse summary response ────────────────────────────────────────────────────
const parseSummaryResponse = (rawText) => {
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed  = JSON.parse(cleaned);
  return {
    studentSummary:   typeof parsed.studentSummary   === "string" ? parsed.studentSummary   : "",
    counselorSummary: typeof parsed.counselorSummary === "string" ? parsed.counselorSummary : "",
  };
};

// ── Single-model attempt for summaries ───────────────────────────────────────
const trySummaryModel = async (apiKey, model, summaryInput) => {
  if (isModelQuotaExhausted(model)) {
    logger.warn(`Skipping ${model} for summary — quota guard active.`);
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: buildSummaryPrompt(summaryInput) }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 400,  // Much smaller — only two short summaries
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",       threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 25000); // shorter timeout for summaries

  let response;
  try {
    response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.ok) {
    const data    = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error(`${model} returned empty content for summary`);
    return parseSummaryResponse(rawText);
  }

  const errorText = await response.text();
  if (response.status === 429) {
    const isDailyQuota = errorText.includes("GenerateRequestsPerDayPerProjectPerModel");
    if (isDailyQuota) markModelQuotaExhausted(model);
    return null;
  }

  throw new Error(`Gemini summary error ${response.status}: ${errorText}`);
};

// ── Main export — Legacy full recommendations ─────────────────────────────────
/**
 * @deprecated Use generateSummaries() in new submissions.
 * Kept for backward compatibility with old pre-assessment submissions.
 */
export const generateAIRecommendations = async (assessmentData) => {
  try {
    logger.info("Generating AI recommendations via Gemini (legacy path)...");
    const result = await generateWithGemini(assessmentData);
    if (result) {
      logger.info(
        `AI recommendations generated (action: ${result.recommendedAction}, model: ${result.model})`
      );
    } else {
      logger.warn("AI recommendations unavailable — all models failed/exhausted.");
    }
    return result;
  } catch (error) {
    logger.error("AI recommendation generation failed:", { error: error.message });
    return null;
  }
};

// ── Main export — Summaries only (new pipeline) ───────────────────────────────
/**
 * Generates only student-facing and counselor-facing summary text.
 * Category, risk, and resources are already determined by the rule-based engine.
 * Returns null on any failure — the engine result is always returned regardless.
 *
 * Token usage: ~400 output tokens max vs ~1200 for full recommendations.
 * This reduces API usage by ~67% compared to the legacy path.
 *
 * @param {{ detectedCategory, riskLevel, riskFactors, selectedResources }} summaryInput
 * @returns {{ studentSummary: string, counselorSummary: string } | null}
 */
export const generateSummaries = async (summaryInput = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.info("GEMINI_API_KEY not set — skipping summaries (expected in offline mode)");
    return null;
  }

  const envModel  = process.env.GEMINI_MODEL;
  const modelChain = envModel
    ? [envModel]
    : ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

  for (const model of modelChain) {
    try {
      logger.info(`Requesting summaries from ${model}…`);
      const result = await trySummaryModel(apiKey, model, summaryInput);
      if (result) {
        logger.info(`Summaries generated via ${model}`);
        return result;
      }
    } catch (err) {
      logger.error(`${model} summary failed: ${err.message}`);
    }
  }

  logger.warn("All models failed for summaries — proceeding without Gemini summaries.");
  return null;
};
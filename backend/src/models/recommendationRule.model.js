import mongoose from "mongoose";

const recommendationRuleSchema = new mongoose.Schema(
  {
    ruleName: { type: String, required: true, trim: true },
    concernCategory: {
      type: String,
      required: true,
      enum: [
        "Academic Burnout",
        "Academic Concern",
        "Career Planning",
        "Family Concern",
        "Social/Relationship Concern",
        "Personal/Emotional Concern",
        "Financial Concern",
        "General Concern",
      ],
    },
    riskLevel: {
      type: String,
      enum: ["Low", "Moderate", "High", "Critical", "Any"],
      default: "Any",
    },
    conditions: {
      minAverageScore:   { type: Number },
      maxAverageScore:   { type: Number },
      requiredPurposes:  [{ type: String }],
      urgencyLevels:     [{ type: String }],
    },
    recommendedResources: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Resource" },
    ],
    nextAction:                { type: String, trim: true },
    counselorPreparationNotes: { type: String, trim: true },
    priority:  { type: Number, default: 0 },
    active:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

recommendationRuleSchema.index({ concernCategory: 1, riskLevel: 1, active: 1 });

const RecommendationRule = mongoose.model(
  "RecommendationRule",
  recommendationRuleSchema
);
export default RecommendationRule;

import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "Academic",
        "Personal/Emotional",
        "Social/Relationship",
        "Family",
        "Career",
        "Financial",
        "General",
      ],
    },
    concernTags: [{ type: String, trim: true }],
    type: {
      type: String,
      enum: ["workshop", "seminar", "webinar", "referral", "session", "program", "other"],
      default: "other",
    },
    audience: [{ type: String }],
    active:    { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

resourceSchema.index({ category: 1, active: 1 });
resourceSchema.index({ concernTags: 1 });

const Resource = mongoose.model("Resource", resourceSchema);
export default Resource;

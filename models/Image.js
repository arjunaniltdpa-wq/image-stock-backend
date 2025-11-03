import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  name: String,       // SEO-friendly name
  fileName: String,   // Original file name
  url: String,
  category: String,   // New: category assigned automatically
  title: String,
  description: String,
  alt: String,
  tags: [String],      // ✅ comma added
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Image", imageSchema);

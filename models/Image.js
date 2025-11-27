// models/Image.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  name: String,                 // SEO-friendly name (human)
  title: String,                // full SEO title
  fileName: String,             // stored filename on R2 (uniqueName)
  thumbnailFileName: String,    // stored thumbnail filename on R2
  url: String,                  // public original file URL
  thumbnailUrl: String,         // public thumbnail URL
  category: String,             // primary category (vehicles, nature...)
  secondaryCategory: String,    // optional secondary category
  description: String,          // SEO description
  alt: String,                  // alt text
  tags: { type: [String], default: [] },     // short tags
  keywords: { type: [String], default: [] }, // meta keywords (longer)
   // ⭐ Add this new field
  slug: {
    type: String,
    required: false,
    index: true
  },
  
  uploadedAt: { type: Date, default: Date.now }
}, { versionKey: false });

export default mongoose.model("Image", imageSchema);

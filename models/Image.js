// models/Image.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  name: String,
  title: String,
  fileName: String,
  thumbnailFileName: String,
  url: String,
  thumbnailUrl: String,
  category: String,
  secondaryCategory: String,
  description: String,
  alt: String,
  tags: { type: [String], default: [] },
  keywords: { type: [String], default: [] },

  // ⭐ SEO slug (clean URL)
  slug: {
    type: String,
    required: true,
    index: true,
    unique: false, // we allow duplicates because slug ends with ID
    lowercase: true, // ⭐ ensures consistent URLs
    trim: true
  },

  uploadedAt: { type: Date, default: Date.now }
}, { versionKey: false });

// ⭐ Ensure slug is always lowercase before saving
imageSchema.pre("save", function (next) {
  if (this.slug) {
    this.slug = this.slug.toLowerCase();
  }
  next();
});

export default mongoose.model("Image", imageSchema);

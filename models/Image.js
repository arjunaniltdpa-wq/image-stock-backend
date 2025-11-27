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

  tags: { 
    type: [String], 
    default: [] 
  },

  keywords: { 
    type: [String], 
    default: [] 
  },

  // ⭐ SEO-friendly slug for clean URLs
  slug: {
    type: String,
    required: true,
    index: true,
    unique: false,      // duplicates allowed because ID makes final URL unique
    lowercase: true,    // auto convert to lowercase
    trim: true
  },

  uploadedAt: { 
    type: Date, 
    default: Date.now 
  }

}, { versionKey: false });


// ⭐ Automatically ensure slug is lowercase before saving
imageSchema.pre("save", function (next) {
  if (this.slug) {
    this.slug = this.slug.toLowerCase().trim();
  }
  next();
});

export default mongoose.model("Image", imageSchema);

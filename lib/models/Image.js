import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    name: String,
    title: String,

    fileName: {
      type: String,
      required: true,
    },

    thumbnailFileName: String,
    previewFileName: String,   // ✅ ADD

    url: String,
    thumbnailUrl: String,
    previewUrl: String,
    
    category: String,
    secondaryCategory: String,

    description: String,
    alt: String,

    // 📏 Exact file size (BYTES)
    size: {
      type: Number,
      default: 0,
    },

    // 📐 Image dimensions
    width: Number,
    height: Number,

    // 📊 Popularity
    downloads: {
      type: Number,
      default: 0,
      index: true,
    },

    tags: {
      type: [String],
      default: [],
      index: true,
    },

    keywords: {
      type: [String],
      default: [],
      index: true,
    },

    // ⭐ SEO slug (slug + _id makes URL unique)
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

// --------------------------------------------------
// INDEXES (DEFINED ONCE — CORRECT WAY)
// --------------------------------------------------
imageSchema.index({ downloads: -1, _id: -1 }); // popular + latest
imageSchema.index({ category: 1 });
imageSchema.index({ uploadedAt: -1 });

// --------------------------------------------------
// PRE-SAVE HOOKS
// --------------------------------------------------
imageSchema.pre("save", function (next) {
  if (this.slug) {
    this.slug = this.slug.toLowerCase().trim();
  }
  next();
});

export default mongoose.model("Image", imageSchema);

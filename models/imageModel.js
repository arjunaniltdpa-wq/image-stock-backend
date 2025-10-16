import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    url: {
      type: String, // Backblaze image URL
      required: true,
    },
    tags: {
      type: [String], // e.g., ["nature", "flower"]
      default: [],
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false } // removes __v field
);

const Image = mongoose.model("Image", imageSchema);
export default Image;

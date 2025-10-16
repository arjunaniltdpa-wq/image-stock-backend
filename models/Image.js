import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  name: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Image", imageSchema);

// checkImages.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// -----------------------------
// 1️⃣ Connect to MongoDB
// -----------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// -----------------------------
// 2️⃣ Define Image Schema
// -----------------------------
const imageSchema = new mongoose.Schema({
  fileName: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now },
});

const Image = mongoose.model("Image", imageSchema, "images"); // replace "images" with your actual collection name

// -----------------------------
// 3️⃣ Fetch and print images
// -----------------------------
async function listImages() {
  try {
    const images = await Image.find({});
    console.log(`Total images in DB: ${images.length}`);
    images.forEach((img, i) => {
      console.log(`${i + 1}. Name: ${img.fileName} | URL: ${img.url} | UploadedAt: ${img.uploadedAt}`);
    });
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error fetching images:", err);
    mongoose.connection.close();
  }
}

listImages();

// bulkUpload.js
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import B2 from "backblaze-b2";
import { generateSEOFromFilename } from "./lib/seoGenerator.js"; // ✅ Import your SEO generator

dotenv.config();

// -----------------------------
// 1️⃣ Config
// -----------------------------
const FOLDER_PATH = "./image-to-upload";
if (!fs.existsSync(FOLDER_PATH)) {
  console.log("❌ Folder 'image-to-upload' not found!");
  process.exit(1);
}

// -----------------------------
// 2️⃣ MongoDB Setup
// -----------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const imageSchema = new mongoose.Schema({
  name: String,       // SEO-friendly name
  fileName: String,   // original file name
  url: String,
  category: String,
  title: String,
  description: String,
  alt: String,
  tags: [String],
  uploadedAt: { type: Date, default: Date.now },
});

const Image = mongoose.model("Image", imageSchema, "images");

// -----------------------------
// 3️⃣ Backblaze Setup
// -----------------------------
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY,
});

const BUCKET_ID = process.env.BACKBLAZE_BUCKET_ID;
const BASE_URL = process.env.BACKBLAZE_BASE_URL; // ex: https://f005.backblazeb2.com/file/pexelora-images/

// -----------------------------
// 4️⃣ Helper Functions
// -----------------------------
function getAllImages(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllImages(filePath)); // recurse subfolders
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
      results.push(filePath);
    }
  });
  return results;
}

// -----------------------------
// 5️⃣ Upload Function
// -----------------------------
async function uploadAll() {
  const files = getAllImages(FOLDER_PATH);
  if (files.length === 0) {
    console.log("No images to upload!");
    return;
  }

  await b2.authorize();
  console.log(`🖼️ Found ${files.length} images.`);

  for (const filePath of files) {
    const fileName = path.basename(filePath);

    try {
      const uploadUrlResponse = await b2.getUploadUrl({ bucketId: BUCKET_ID });

      // Upload using original file name
      await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName: fileName,
        data: fs.readFileSync(filePath),
      });

      // ✅ Generate SEO automatically
      const seo = generateSEOFromFilename(fileName);

      await Image.create({
        name: fileName.toLowerCase().replace(/\s+/g, "-"), // SEO-friendly name
        fileName,
        url: `${BASE_URL}${encodeURIComponent(fileName)}`,
        category: seo.category,
        title: seo.title,
        description: seo.description,
        alt: seo.alt,
        tags: seo.tags,
        uploadedAt: new Date(),
      });

      fs.unlinkSync(filePath); // remove local file
      console.log(`✅ Uploaded & SEO added: ${fileName}`);
    } catch (err) {
      console.error(`❌ Failed for ${fileName}:`, err.message);
    }
  }

  console.log("🎉 All images processed successfully!");
  process.exit(0);
}

// -----------------------------
// 6️⃣ Run
// -----------------------------
uploadAll();

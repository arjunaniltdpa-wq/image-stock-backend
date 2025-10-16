import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// -----------------------------
// 1️⃣ Config
// -----------------------------
const folderPath = "./images-to-upload"; // Your images folder
const processedFolder = "./processed"; // Move uploaded files here

// Backblaze B2 keys from .env
const B2_ACCOUNT_ID = process.env.B2_ACCOUNT_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const BUCKET_ID = process.env.B2_BUCKET_ID;
const BATCH_SIZE = 50; // Adjustable for daily 500 images
const RETRY_LIMIT = 3;

if (!fs.existsSync(processedFolder)) fs.mkdirSync(processedFolder);

let AUTH_TOKEN = "";
let UPLOAD_URL = "";

// -----------------------------
// 2️⃣ MongoDB Setup
// -----------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const imageSchema = new mongoose.Schema({
  fileName: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now },
});

const Image = mongoose.model("Image", imageSchema, "images"); // collection "images"

// -----------------------------
// 3️⃣ Authenticate & get upload URL
// -----------------------------
async function authorizeB2() {
  const auth = Buffer.from(`${B2_ACCOUNT_ID}:${B2_APPLICATION_KEY}`).toString("base64");
  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();

  AUTH_TOKEN = data.authorizationToken;
  console.log("✅ Authenticated successfully");

  const uploadRes = await fetch(`${data.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: AUTH_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: BUCKET_ID }),
  });
  const uploadData = await uploadRes.json();

  UPLOAD_URL = uploadData.uploadUrl;
  AUTH_TOKEN = uploadData.authorizationToken;

  console.log("✅ Upload URL ready");
}

// -----------------------------
// 4️⃣ Upload single file with retry
// -----------------------------
async function uploadSingle(filePath, fileName, attempt = 1) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const sha1 = crypto.createHash("sha1").update(fileBuffer).digest("hex");

    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: AUTH_TOKEN,
        "X-Bz-File-Name": encodeURIComponent(fileName),
        "Content-Type": "b2/x-auto",
        "Content-Length": fileBuffer.length.toString(),
        "X-Bz-Content-Sha1": sha1,
      },
      body: fileBuffer,
    });

    const data = await res.json();

    if (res.status === 200) {
      console.log(`✅ Uploaded: ${fileName}`);

      // Save metadata to MongoDB
      await Image.create({ fileName, url: fileName });

      // Move uploaded file
      fs.renameSync(filePath, path.join(processedFolder, fileName));
      return true;
    } else {
      if (attempt < RETRY_LIMIT) {
        console.log(`⚠️ Retry ${attempt} for ${fileName}`);
        return uploadSingle(filePath, fileName, attempt + 1);
      } else {
        console.error(`❌ Failed: ${fileName}`, data.message || data);
        return false;
      }
    }
  } catch (err) {
    if (attempt < RETRY_LIMIT) {
      console.log(`⚠️ Retry ${attempt} for ${fileName} (Error)`);
      return uploadSingle(filePath, fileName, attempt + 1);
    } else {
      console.error(`❌ Error: ${fileName}`, err.message);
      return false;
    }
  }
}

// -----------------------------
// 5️⃣ Main batch upload (Sequential)
// -----------------------------
async function uploadAll() {
  const files = fs.readdirSync(folderPath).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log(`Total files to upload: ${files.length}`);

  if (files.length === 0) {
    console.log("No files to upload!");
    return;
  }

  await authorizeB2();

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    for (const fileName of batch) {
      await uploadSingle(path.join(folderPath, fileName), fileName); // sequential
    }

    console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} completed`);
  }

  console.log("🎉 All images processed!");
}


// -----------------------------
// 6️⃣ Run the script
// -----------------------------
uploadAll();

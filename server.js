// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import B2 from "backblaze-b2";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import imageRoutes from "./routes/imageRoutes.js";
import Image from "./models/Image.js";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import fetch from "node-fetch";
import FormData from "form-data";
import { fileURLToPath } from "url";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// ✅ SEO IMPORT
import { generateSEOFromFilename } from "./lib/seoGenerator.js";

// ---------------------------
// ES Module __dirname setup
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------
// dotenv config
// ---------------------------
dotenv.config();

// ---------------------------
// Express app
// ---------------------------
const app = express();

// ---------------------------
// Middleware
// ---------------------------
app.use(cors({ origin: "*" }));
app.use(express.json());

// ---------------------------
// Multer setup (memory)
// ---------------------------
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------
// MongoDB connection
// ---------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ---------------------------
// Backblaze B2 setup
// ---------------------------
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY,
});

// ✅ Helper: Build signed B2 "download by filename" URL
async function buildB2SignedByNameUrl(fileName) {
  await b2.authorize();

  const auth = await b2.getDownloadAuthorization({
    bucketId: process.env.BACKBLAZE_BUCKET_ID,
    fileNamePrefix: fileName,
    validDurationInSeconds: 3600,
  });

  const { data: { downloadUrl } } = await b2.authorize();

  return `${downloadUrl}/file/${process.env.BACKBLAZE_BUCKET_NAME}/${encodeURIComponent(fileName)}?Authorization=${auth.data.authorizationToken}`;
}

const BULK_UPLOAD_FOLDER = path.join(__dirname, "image-to-upload");

// ---------------------------
// Bulk upload with SEO Auto
// ---------------------------
async function uploadLocalFolderToBackblaze() {
  const files = fs.readdirSync(BULK_UPLOAD_FOLDER).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (files.length === 0) return console.log("No files to upload in image-to-upload folder.");

  await b2.authorize();

  for (const fileName of files) {
    const filePath = path.join(BULK_UPLOAD_FOLDER, fileName);

    try {
      const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.BACKBLAZE_BUCKET_ID });

      const buffer = fs.readFileSync(filePath);

      await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName,
        data: buffer,
      });

      const thumbBuffer = await sharp(buffer).resize({ width: 400 }).jpeg({ quality: 70 }).toBuffer();
      const thumbName = `thumb_${fileName}`;

      await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName: thumbName,
        data: thumbBuffer,
      });

      const seo = generateSEOFromFilename(fileName);

      await Image.create({
        name: seo.title,
        fileName,
        thumbnailFileName: thumbName,
        url: `${process.env.BACKBLAZE_BASE_URL}${encodeURIComponent(fileName)}`,
        category: seo.category,
        tags: seo.tags,
        description: seo.description,
        altText: seo.alt,
        uploadedAt: new Date(),
      });

      fs.unlinkSync(filePath);
      console.log(`✅ Uploaded with thumbnail + SEO: ${fileName}`);

    } catch (err) {
      console.error(`❌ Failed for ${fileName}:`, err.message);
    }
  }

  console.log("🎉 All local images uploaded (original + thumbnail) with SEO!");
}

// ---------------------------
// Cloudinary config
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------------------
// Popular Images Endpoint
// ---------------------------
app.get("/api/images/popular", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const images = await Image.find().sort({ uploadedAt: -1 }).skip(skip).limit(limit);

    const data = images.map(img => {
      const file = img.fileName || img.url;
      const thumb = img.thumbnailFileName || img.fileName || img.url;

      return {
        _id: img._id,
        name: img.name || file,
        url: `/api/images/file/${encodeURIComponent(file)}`,
        thumbnailUrl: `/api/images/file/${encodeURIComponent(thumb)}`,
        tags: img.tags || []
      };
    });

    res.json({ images: data });
  } catch (err) {
    console.error("❌ Popular images fetch error:", err);
    res.status(500).json({ message: "Failed to fetch popular images", details: err.message });
  }
});

// ---------------------------
// Backblaze Upload endpoint (✅ SEO added)
// ---------------------------
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    await b2.authorize();
    const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.BACKBLAZE_BUCKET_ID });

    await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: req.file.originalname,
      data: req.file.buffer,
    });

    const seo = generateSEOFromFilename(req.file.originalname);

    const imageDoc = new Image({
      name: seo.title,
      fileName: req.file.originalname,
      url: `${process.env.BACKBLAZE_BASE_URL}${encodeURIComponent(req.file.originalname)}`,
      category: seo.category,
      tags: seo.tags,
      description: seo.description,
      altText: seo.alt,
      uploadedAt: new Date()
    });

    await imageDoc.save();

    res.json({ message: "✅ Uploaded successfully with SEO", fileName: req.file.originalname, seo });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ✅ ✅ ✅ RUNWARE UPSCALE
app.post("/api/upscale", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const inputPath = path.join("uploads", `input_${Date.now()}.jpg`);
    fs.writeFileSync(inputPath, req.file.buffer);

    const imageURL = `${req.protocol}://${req.get("host")}/${inputPath}`;

    const response = await axios.post(
      "https://api.runware.ai/v1/upscale",
      [
        {
          taskType: "upscale",
          taskUUID: uuidv4(),
          imageURL: imageURL,
          scale: 4
        }
      ],
      {
        headers: {
          Authorization: `Bearer ${process.env.RUNWARE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      }
    );

    if (!response.data?.[0]?.data?.output) {
      throw new Error("No output returned from Runware");
    }

    const outputBase64 = response.data[0].data.output;
    const outputBuffer = Buffer.from(outputBase64, "base64");

    const outputPath = path.join("uploads", `upscaled_${Date.now()}.jpg`);
    fs.writeFileSync(outputPath, outputBuffer);

    const publicUrl = `${req.protocol}://${req.get("host")}/${outputPath}`;

    res.json({ success: true, outputUrl: publicUrl });

  } catch (err) {
    console.error("❌ Runware Upscale Error:", err.response?.data || err.message);
    res.status(500).json({ message: "Upscale failed", details: err.message });
  }
});

// ---------------------------
// Remove.bg proxy endpoint
// ---------------------------
app.post("/api/remove-bg", upload.single("image_file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const form = new FormData();
    form.append("image_file", req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    form.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVEBG_API_KEY,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ message: "remove.bg failed", details: errText });
    }

    const arrayBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "image/png");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("❌ Remove-bg proxy error:", err);
    res.status(500).json({ message: "Remove-bg failed", details: err.message });
  }
});

// ✅ ✅ ✅ PRIVATE BUCKET FILE PROXY (FIXED)
app.get("/api/images/file/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    const width = req.query.width ? parseInt(req.query.width) : null;
    const height = req.query.height ? parseInt(req.query.height) : null;
    const crop = req.query.crop; // ?crop=true

    const signedUrl = await buildB2SignedByNameUrl(fileName);
    const response = await axios.get(signedUrl, { responseType: "arraybuffer" });

    const imageBuffer = Buffer.from(response.data);

    let finalBuffer = imageBuffer;

    // ✅ Resize logic (portrait + landscape safe)
    if (width || height) {
      let sharpOptions = { fit: "inside" };

      // ✅ Crop square mode (Instagram style)
      if (crop === "true") {
        sharpOptions = { fit: "cover", position: "center" }; 
      }

      finalBuffer = await sharp(imageBuffer)
        .resize(width, height, sharpOptions)
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    res.send(finalBuffer);

  } catch (err) {
    console.error("❌ Private bucket file proxy error:", err.message);
    res.status(500).json({ message: "Failed to fetch file", details: err.message });
  }
});


// ✅ ✅ ✅ SIGNED URL GENERATOR (FIXED)
app.get("/api/get-file-url/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    const url = await buildB2SignedByNameUrl(fileName);
    res.json({ url });
  } catch (err) {
    console.error("❌ Signed URL generation error:", err.message);
    res.status(500).json({ message: "Failed to generate signed URL", details: err.message });
  }
});

// ---------------------------
// Image API routes
// ---------------------------
app.use("/api/images", imageRoutes);

// ---------------------------
const localUploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir);
app.use("/uploads", express.static(localUploadDir));

// ---------------------------
app.get("/", (req, res) => res.send("Backend is live. Connect your frontend!"));

// ---------------------------
// Compressor & Converter
// ---------------------------
app.post("/api/compress", upload.single("image_file"), async (req, res) => {
  try {
    const buffer = await sharp(req.file.buffer).jpeg({ quality: 60 }).toBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: "Compression failed", details: err.message });
  }
});

app.post("/api/convert", upload.single("image_file"), async (req, res) => {
  try {
    const format = req.body.format?.toLowerCase();
    if (!format) return res.status(400).json({ message: "No format specified" });

    const validFormats = ["jpg", "jpeg", "png", "webp", "tiff", "pdf"];
    if (!validFormats.includes(format)) return res.status(400).json({ message: "Invalid format" });

    if (format === "pdf") {
      const pdfDoc = await PDFDocument.create();
      const metadata = await sharp(req.file.buffer).metadata();
      const img = metadata.format === "png" ? await pdfDoc.embedPng(req.file.buffer) : await pdfDoc.embedJpg(req.file.buffer);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      return res.send(Buffer.from(pdfBytes));
    }

    const converted = await sharp(req.file.buffer).toFormat(format).toBuffer();
    const mime = `image/${format === "jpg" ? "jpeg" : format}`;
    res.setHeader("Content-Type", mime);
    res.send(converted);
  } catch (err) {
    res.status(500).json({ message: "Conversion failed", details: err.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

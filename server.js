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

const BULK_UPLOAD_FOLDER = path.join(__dirname, "image-to-upload");

// ---------------------------
// Bulk upload folder function (keep original names)
// ---------------------------
async function uploadLocalFolderToBackblaze() {
  const files = fs.readdirSync(BULK_UPLOAD_FOLDER).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (files.length === 0) return console.log("No files to upload in image-to-upload folder.");

  await b2.authorize();

  for (const fileName of files) {
    const filePath = path.join(BULK_UPLOAD_FOLDER, fileName);

    try {
      const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.BACKBLAZE_BUCKET_ID });
      await b2.uploadFile({
        uploadUrl: uploadUrlResponse.data.uploadUrl,
        uploadAuthToken: uploadUrlResponse.data.authorizationToken,
        fileName, // ✅ keep original filename
        data: fs.readFileSync(filePath),
      });

      await Image.create({
        name: fileName, // ✅ original name
        fileName,
        url: `${process.env.BACKBLAZE_BASE_URL}${encodeURIComponent(fileName)}`,
        category: "uncategorized", // default
        uploadedAt: new Date(),
      });

      fs.unlinkSync(filePath);
      console.log(`✅ Uploaded: ${fileName}`);
    } catch (err) {
      console.error(`❌ Failed for ${fileName}:`, err.message);
    }
  }

  console.log("🎉 All local images uploaded to Backblaze!");
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

    const images = await Image.find()
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit);

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
// Backblaze Upload endpoint (keep original names)
// ---------------------------
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    await b2.authorize();
    const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.BACKBLAZE_BUCKET_ID });
    await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: file.originalname, // ✅ keep original filename
      data: file.buffer,
    });

    const imageDoc = new Image({
      name: file.originalname, // ✅ original name
      fileName: file.originalname,
      url: `${process.env.BACKBLAZE_BASE_URL}${encodeURIComponent(file.originalname)}`,
      category: "uncategorized",
      uploadedAt: new Date()
    });
    await imageDoc.save();

    res.json({ message: "✅ Uploaded successfully", fileName: file.originalname });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});


// ---------------------------
// LIGHTX UPSCALE - 4X QUALITY ENHANCEMENT
// ---------------------------

const LIGHTX_API_KEY = "ef80324dd4b44f0c92b5abab16c67e11_cbc9ddaf314d4d639cc730bb8a0cae9e_andoraitools";

// 4× Upscale Endpoint
app.post("/api/upscale", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("📸 Received file for upscale:", {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });

    // Prepare LightX form data
    const form = new FormData();
    form.append("image_file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append("scale", "4"); // ✅ 4x upscale
    form.append("output_format", "jpg"); // or "png"

    console.log("⏫ Sending image to LightX API...");

    const lightxResponse = await axios.post(
      "https://api.lightxeditor.com/v2/upscale",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${LIGHTX_API_KEY}`, // ✅ FIXED
        },
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );

    console.log("✅ Upscale successful from LightX");

    // Save upscaled image temporarily
    const outputPath = path.join("uploads", `upscaled_${Date.now()}.jpg`);
    fs.writeFileSync(outputPath, Buffer.from(lightxResponse.data));

    // Return public URL for frontend
    const publicUrl = `${req.protocol}://${req.get("host")}/${outputPath}`;

    return res.json({
      success: true,
      outputUrl: publicUrl,
      message: "Upscale completed successfully",
    });
  } catch (err) {
    console.error("❌ LightX Upscale Error:", err.response?.data || err.message);
    res.status(500).json({
      message: "Upscale failed",
      details: err.response?.data || err.message,
    });
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

    const removeBgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVEBG_API_KEY,
        ...form.getHeaders()
      },
      body: form
    });

    if (!removeBgResponse.ok) {
      const errText = await removeBgResponse.text();
      console.error("❌ remove.bg error:", errText);
      return res.status(removeBgResponse.status).json({ message: "remove.bg failed", details: errText });
    }

    const arrayBuffer = await removeBgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("❌ Remove-bg proxy error:", err);
    res.status(500).json({ message: "Remove-bg failed", details: err.message });
  }
});

// ---------------------------
// Backblaze File Proxy
// ---------------------------
app.get("/api/images/file/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);

    await b2.authorize();
    const download = await b2.downloadFileByName({  
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
      fileName
    });

    const buffer = Buffer.from(download.data);
    const ext = fileName.split(".").pop().toLowerCase();
    res.setHeader(
      "Content-Type",
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "application/octet-stream"
    );

    res.send(buffer);
  } catch (err) {
    console.error("❌ File proxy error:", err);
    res.status(500).json({ message: "Failed to fetch file", details: err.message });
  }
});

// ---------------------------
// Image API routes
// ---------------------------
app.use("/api/images", imageRoutes);

// ---------------------------
// Local uploads folder
// ---------------------------
const localUploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir);
app.use("/uploads", express.static(localUploadDir));

// ---------------------------
// Root
// ---------------------------
app.get("/", (req, res) => {
  res.send("Backend is live. Connect your frontend!");
});

// ---------------------------
// Image Compressor Proxy
// ---------------------------
app.post("/api/compress", upload.single("image_file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const compressedBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 60 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.send(compressedBuffer);
  } catch (err) {
    console.error("❌ Compress error:", err);
    res.status(500).json({ message: "Compression failed", details: err.message });
  }
});

// ---------------------------
// Format Converter Proxy
// ---------------------------
app.post("/api/convert", upload.single("image_file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const format = req.body.format?.toLowerCase();
    if (!format) return res.status(400).json({ message: "No format specified" });

    if (format === "pdf") {
      const imgBuffer = req.file.buffer;
      const pdfDoc = await PDFDocument.create();
      const metadata = await sharp(imgBuffer).metadata();

      let img;
      if (metadata.format === "png") img = await pdfDoc.embedPng(imgBuffer);
      else if (["jpeg", "jpg"].includes(metadata.format)) img = await pdfDoc.embedJpg(imgBuffer);
      else return res.status(400).json({ message: "Unsupported image format for PDF" });

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      return res.send(Buffer.from(pdfBytes));
    }

    const validFormats = ["jpg", "jpeg", "png", "webp", "tiff"];
    if (!validFormats.includes(format)) return res.status(400).json({ message: "Invalid format" });

    const convertedBuffer = await sharp(req.file.buffer)
      .toFormat(format)
      .toBuffer();

    const mime = `image/${format === "jpg" ? "jpeg" : format}`;
    res.setHeader("Content-Type", mime);
    res.send(convertedBuffer);
  } catch (err) {
    console.error("❌ Conversion route error:", err);
    res.status(500).json({ message: "Conversion failed", details: err.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
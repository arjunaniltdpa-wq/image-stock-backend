// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import imageRoutes from "./routes/imageRoutes.js";
import Image from "./models/Image.js";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { fileURLToPath } from "url";
import mime from "mime";

import { generateSEOFromFilename } from "./lib/seoGenerator.js";

sharp.concurrency(1);
sharp.cache(false);

// AWS SDK v3 for Cloudflare R2
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (!fs.existsSync("tmp_uploads")) {
  fs.mkdirSync("tmp_uploads");
}

const tmpDir = "tmp_uploads";
if (fs.existsSync(tmpDir)) {
  fs.readdirSync(tmpDir).forEach(file => {
    fs.unlinkSync(path.join(tmpDir, file));
  });
}

// ES Module __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv
dotenv.config();

// Express app
const app = express();

// 1️⃣ FIX slug-id-id → slug-id (RegExp route)
app.get(/^\/photo\/(.+)-([a-f0-9]{24})-\2$/, (req, res) => {
  const slug = req.params[0];
  const id = req.params[1];

  return res.redirect(301, `/photo/${slug}-${id}`);
});

// 2️⃣ FIX slug WITHOUT ID → redirect to slug-ID
app.get(/^\/photo\/([^\/-]+(?:-[^\/-]+)*)$/, async (req, res, next) => {
  const baseSlug = req.params[0];

  // Skip if already ends with Mongo ID
  if (baseSlug.match(/[a-f0-9]{24}$/i)) {
    return next();
  }

  try {
    const image = await Image.findOne({
      slug: new RegExp(`^${baseSlug}-[a-f0-9]{24}$`, "i")
    }).select("slug");

    if (!image) return next();

    return res.redirect(301, `/photo/${image.slug}`);
  } catch (e) {
    console.error("Slug redirect error:", e.message);
    return next();
  }
});

// 🔥 1️⃣ OG PAGE — ABSOLUTELY FIRST
import ogPage from "./routes/ogPage.js";
app.use("/photo", ogPage);

// 🔥 2️⃣ OG IMAGE (optional)
import ogRoute from "./routes/og.js";
app.use("/api/og", ogRoute);

// 3️⃣ Middleware (AFTER OG)
app.use(cors({ origin: "*" }));
app.use(express.json());

// 4️⃣ APIs
import searchRoutes from "./routes/search.js";
app.use("/api/search", searchRoutes);
app.use("/api/images", imageRoutes);


// 5️⃣ STATIC — ALWAYS LAST
app.use(express.static(path.join(__dirname, "public")));



// Multer memory storage
const upload = multer({ dest: "tmp_uploads/" });

// ---------------------------
// MongoDB connection
// ---------------------------

mongoose.connect(process.env.MONGO_URI, {})
  .then(async () => {
    console.log("✅ MongoDB connected");
    await uploadLocalFolderToR2(); // 🔥 IMPORTANT
  })
  .catch(err => console.error("❌ MongoDB error:", err));

// ---------------------------
// API ROUTES
// ---------------------------

import removeBg from "./routes/removeBg.js";
app.use("/api/remove-bg", removeBg);

import popularLatest from "./routes/popularLatest.js";
app.use("/api/images/popular-latest", popularLatest);


// ---------------------------
// Cloudflare R2 SETUP
// ---------------------------
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

import sitemapRoute from "./sitemap.js";
app.use("/", sitemapRoute);


app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.sendFile(path.join(__dirname, "robots.txt"));
});

// Build public R2 URL
function buildR2PublicUrl(fileName) {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return `${base}${encodeURIComponent(fileName)}`;
}

async function getR2PresignedUrl(key, expiresSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresSeconds });
}

const BULK_UPLOAD_FOLDER = path.join(__dirname, "image-to-upload");

// ======================================================
//  RETRY HELPER + ERROR LOGGING + MONGO FALLBACK
// ======================================================
async function retry(fn, attempts = 3, delay = 1200) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`Retry ${i + 1} failed: ${err.message}`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError;
}

function writeFallbackLog(file, data) {
  const dir = path.join(__dirname, "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const filePath = path.join(dir, file);

  let existing = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  existing.push(data);

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

// ======================================================
// UPDATED — BULK UPLOAD FUNCTION (FIXED & SAFE)
// ======================================================
async function uploadLocalFolderToR2() {
  if (!fs.existsSync(BULK_UPLOAD_FOLDER)) return;

  const files = fs.readdirSync(BULK_UPLOAD_FOLDER).filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  for (const fileName of files) {
    const filePath = path.join(BULK_UPLOAD_FOLDER, fileName);

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;

      const ext = path.extname(fileName).slice(1);
      const contentType = mime.getType(ext) || "application/octet-stream";

      const safeOriginalName = fileName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9.\-]/g, "");

      const uniqueName = `${Date.now()}-${safeOriginalName}`;
      const thumbName = `thumb_${uniqueName}`;
      const previewName = `preview_${uniqueName.replace(/\.(jpg|jpeg|png)$/i, ".webp")}`;

      // ---------------- ORIGINAL ----------------
      await retry(() =>
        s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: uniqueName,
            Body: fs.createReadStream(filePath),
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
          })
        )
      );

      // ---------------- THUMB ----------------
        const thumbPath = path.join(tmpDir, thumbName);

        await sharp(filePath)
          .rotate() // 🔥 fixes portrait/landscape EXIF issues
          .resize({
            width: 400,
            withoutEnlargement: true
          })
          .webp({ quality: 75 })
          .toFile(thumbPath);

        await retry(() =>
          s3Client.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: thumbName,
              Body: fs.createReadStream(thumbPath),
              ContentType: "image/webp",
              CacheControl: "public, max-age=31536000, immutable",
            })
          )
        );

        fs.unlinkSync(thumbPath);

      // ---------------- PREVIEW (WEBP) ----------------
      const previewPath = path.join(tmpDir, previewName);
      await sharp(filePath)
        .rotate()
        .resize({
          width: 1200,
          withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(previewPath);

      await retry(() =>
        s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: previewName,
            Body: fs.createReadStream(previewPath),
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          })
        )
      );
      fs.unlinkSync(previewPath);

      // ---------------- SEO + DB ----------------
      const seo = generateSEOFromFilename(fileName);
      const slug = (seo.slug || uniqueName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const meta = await sharp(filePath).metadata();

      const doc = await Image.create({
        title: seo.title,
        slug,
        fileName: uniqueName,
        thumbnailFileName: thumbName,
        previewFileName: previewName,
        url: buildR2PublicUrl(uniqueName),
        thumbnailUrl: buildR2PublicUrl(thumbName),
        previewUrl: buildR2PublicUrl(previewName),
        size: fileSize,
        width: meta.width,
        height: meta.height,
        tags: seo.tags,
        keywords: seo.keywords,
        description: seo.description,
        alt: seo.alt,
        uploadedAt: new Date(),
      });

      doc.slug = `${slug}-${doc._id}`;
      await doc.save();

      fs.unlinkSync(filePath);
      console.log(`✅ Uploaded: ${uniqueName}`);

    } catch (err) {
      console.error("❌ Bulk Upload Error:", err.message);
      writeFallbackLog("failed_uploads.json", {
        file: fileName,
        error: err.message,
        time: new Date(),
      });
    }
  }
}

// ---------------------------
// Static uploads folder
// ---------------------------
const localUploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir);
app.use("/uploads", express.static(localUploadDir));

// ---------------------------
// Compression API
// ---------------------------
app.post("/api/compress", upload.single("image_file"), async (req, res) => {
  try {
    const output = await sharp(req.file.path)
      .jpeg({ quality: 60 })
      .toBuffer();

    fs.unlinkSync(req.file.path);
    res.send(output);
  } catch (err) {
    res.status(500).json({ message: "Failed", details: err.message });
  }
});


// ---------------------------
// Conversion API (SAFE)
// ---------------------------
app.post("/api/convert", upload.single("image_file"), async (req, res) => {
  try {
    const format = req.body.format?.toLowerCase();
    if (!format) return res.status(400).json({ message: "No format" });

    const valid = ["jpg", "jpeg", "png", "webp", "tiff", "pdf"];
    if (!valid.includes(format))
      return res.status(400).json({ message: "Invalid format" });

    const filePath = req.file.path;

    // ---------- PDF ----------
    if (format === "pdf") {
      const pdfDoc = await PDFDocument.create();

      // Read file ONCE (PDF needs buffer)
      const imageBuffer = await fs.promises.readFile(filePath);
      const metadata = await sharp(filePath).metadata();

      const img =
        metadata.format === "png"
          ? await pdfDoc.embedPng(imageBuffer)
          : await pdfDoc.embedJpg(imageBuffer);

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
      });

      const pdfBytes = await pdfDoc.save();

      fs.unlinkSync(filePath); // cleanup

      res.setHeader("Content-Type", "application/pdf");
      return res.send(Buffer.from(pdfBytes));
    }

    // ---------- IMAGE FORMATS ----------
    const converted = await sharp(filePath)
      .toFormat(format)
      .toBuffer();

    fs.unlinkSync(filePath); // cleanup

    res.setHeader("Content-Type", mime.getType(format));
    res.send(converted);

  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      message: "Conversion failed",
      details: err.message,
    });
  }
});
// ---------------------------
// SINGLE IMAGE UPLOAD TO R2 (MATCH BULK)
// ---------------------------
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const originalName = req.file.originalname;
    const filePath = req.file.path;

    const safeOriginalName = originalName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "");

    const uniqueName = `${Date.now()}-${safeOriginalName}`;
    const thumbName = `thumb_${uniqueName}`;
    const previewName = `preview_${uniqueName.replace(/\.(jpg|jpeg|png)$/i, ".webp")}`;

    const ext = path.extname(originalName).slice(1).toLowerCase();
    const contentType = mime.getType(ext) || "application/octet-stream";

    // ---------- ORIGINAL ----------
    await retry(() =>
      s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: uniqueName,
          Body: fs.createReadStream(filePath),
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      )
    );

    // ---------- THUMB (WEBP 400px) ----------
    const thumbPath = path.join(tmpDir, thumbName);
    await sharp(filePath)
      .rotate() // 🔥 fixes portrait/landscape EXIF issues
      .resize({
        width: 400,
        withoutEnlargement: true
      })
      .webp({ quality: 75 })
      .toFile(thumbPath);

    await retry(() =>
      s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbName,
          Body: fs.createReadStream(thumbPath),
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      )
    );
    fs.unlinkSync(thumbPath);

    // ---------- PREVIEW (WEBP 1200px) ----------
    const previewPath = path.join(tmpDir, previewName);
    await sharp(filePath)
      .rotate()
      .resize({
        width: 1200,
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(previewPath);

    await retry(() =>
      s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: previewName,
          Body: fs.createReadStream(previewPath),
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      )
    );
    fs.unlinkSync(previewPath);

    // ---------- META ----------
    const stat = fs.statSync(filePath);
    const seo = generateSEOFromFilename(originalName);
    const meta = await sharp(filePath).metadata();

    const slug = (seo.slug || uniqueName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // ---------- SAVE DB ----------
    const doc = await Image.create({
      title: seo.title,
      slug,
      fileName: uniqueName,
      thumbnailFileName: thumbName,
      previewFileName: previewName,
      url: buildR2PublicUrl(uniqueName),
      thumbnailUrl: buildR2PublicUrl(thumbName),
      previewUrl: buildR2PublicUrl(previewName),
      size: stat.size,
      width: meta.width,
      height: meta.height,
      tags: seo.tags,
      keywords: seo.keywords,
      description: seo.description,
      alt: seo.alt,
      uploadedAt: new Date(),
    });

    doc.slug = `${slug}-${doc._id}`;
    await doc.save();

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      url: buildR2PublicUrl(uniqueName),
      thumbnailUrl: buildR2PublicUrl(thumbName),
      previewUrl: buildR2PublicUrl(previewName),
    });

  } catch (err) {
    console.error("Single Upload Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message,
    });
  }
});

// Real image info size
app.get("/api/images/slug/:slug", async (req, res) => {
  const image = await Image.findOne({ slug: req.params.slug }).lean();
  if (!image) return res.status(404).json({});

  res.json({
    _id: image._id,
    title: image.title,
    slug: image.slug,

    fileName: image.fileName,
    thumbnailFileName: image.thumbnailFileName,
    previewFileName: image.previewFileName,

    url: image.url,
    thumbnailUrl: image.thumbnailUrl,
    previewUrl: image.previewUrl,

    size: image.size,
    width: image.width,
    height: image.height,

    description: image.description,
    alt: image.alt,
    category: image.category,
    tags: image.tags,
    keywords: image.keywords
  });
});

// ---------------------------
// FINAL ROOT ROUTE
// ---------------------------
app.get("/", (req, res) => {
  res.json({ status: "Pixeora API running" });
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));

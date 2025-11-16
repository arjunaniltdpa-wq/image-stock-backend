/**
 * advanced-fast-cleanup.js
 *
 * Fast Full Cleanup (missing files, corrupted detection, thumbnail regen, metadata repair)
 * - Lists R2 objects once (paginated) and builds a key->size map
 * - Processes MongoDB Image documents in parallel (controlled concurrency)
 * - Deletes DB records for missing or tiny (corrupted) files
 * - Regenerates thumbnails when missing (downloads only those images)
 * - Repairs metadata using generateSEOFromFilename
 * - Writes logs to cleanup_logs/
 *
 * Usage:
 *   node advanced-fast-cleanup.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Image from "./models/Image.js";

import fs from "fs";
import path from "path";
import sharp from "sharp";

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";

import { generateSEOFromFilename } from "./lib/seoGenerator.js";

// CONFIG
const CONCURRENCY = 10;            // number of parallel workers
const MIN_BYTES = 5000;           // if object size < MIN_BYTES => treat as corrupted
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 70;

// R2 client
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Helper: list all objects in bucket (paginated) -> returns map { key -> size }
async function listAllR2Objects(bucket) {
  let continuationToken = undefined;
  const map = new Map();

  while (true) {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    });

    const res = await s3.send(cmd);
    if (res.Contents) {
      for (const obj of res.Contents) {
        // Key and Size are present in list results
        map.set(obj.Key, obj.Size || 0);
      }
    }

    if (res.IsTruncated) {
      continuationToken = res.NextContinuationToken;
    } else {
      break;
    }
  }

  return map;
}

// Helper: download object buffer
async function downloadR2Buffer(bucket, key) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await s3.send(cmd);
  // Node SDK v3: Body has transformToByteArray() in modern runtimes
  const bodyBuffer = Buffer.from(await res.Body.transformToByteArray());
  return bodyBuffer;
}

// Helper: upload buffer to R2
async function uploadR2Buffer(bucket, key, bodyBuffer, contentType = "image/jpeg") {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bodyBuffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable"
  });
  await s3.send(cmd);
}

// Concurrency runner
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (queue.length === 0 || active >= concurrency) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve).catch(reject).finally(() => {
      active--;
      next();
    });
  };

  return function run(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

async function main() {
  console.log("🔵 Advanced Fast Cleanup (full) STARTING...");

  // ensure logs folder
  const logsDir = path.join(process.cwd(), "cleanup_logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

  // 1. list R2 objects once (key -> size)
  console.log("1) Listing R2 objects...");
  const r2Map = await listAllR2Objects(process.env.R2_BUCKET_NAME);
  console.log(`   R2 objects indexed: ${r2Map.size}`);

  // 2. Connect to MongoDB and fetch all image docs
  console.log("2) Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, {});

  const images = await Image.find({});
  console.log(`   Mongo images fetched: ${images.length}`);

  // results arrays
  const removed = [];
  const repaired = [];
  const metadataFixed = [];

  // limiter
  const runLimited = pLimit(CONCURRENCY);

  // processing function per image
  const tasks = images.map(img => runLimited(async () => {
    const fileName = img.fileName;
    const thumbName = img.thumbnailFileName;

    // If fileName not in r2 => delete DB record
    if (!r2Map.has(fileName)) {
      removed.push({ fileName, reason: "Main missing in R2" });
      await Image.deleteOne({ _id: img._id });
      return;
    }

    // If file size is tiny -> treat as corrupted -> delete DB record
    const size = r2Map.get(fileName) || 0;
    if (size < MIN_BYTES) {
      removed.push({ fileName, reason: `Size too small (${size} bytes)` });
      await Image.deleteOne({ _id: img._id });
      return;
    }

    // If thumbnail missing -> download main, validate and regenerate thumb
    const thumbExists = r2Map.has(thumbName);
    if (!thumbExists || !thumbName) {
      // download main image
      try {
        const buf = await downloadR2Buffer(process.env.R2_BUCKET_NAME, fileName);

        // validate via sharp
        try {
          await sharp(buf).metadata();
        } catch (err) {
          // corrupted -> delete DB doc
          removed.push({ fileName, reason: `Sharp metadata failed (corrupted). err:${err.message}` });
          await Image.deleteOne({ _id: img._id });
          return;
        }

        // regenerate thumbnail
        const thumbBuf = await sharp(buf)
          .resize({ width: THUMB_WIDTH })
          .jpeg({ quality: THUMB_QUALITY })
          .toBuffer();

        const newThumbName = `thumb_${fileName}`;
        await uploadR2Buffer(process.env.R2_BUCKET_NAME, newThumbName, thumbBuf, "image/jpeg");

        // update mongodb thumbnailFileName and save
        img.thumbnailFileName = newThumbName;
        await img.save();

        // update local r2 map so subsequent images see thumb
        r2Map.set(newThumbName, thumbBuf.length);

        repaired.push({ fileName, fix: "Thumbnail regenerated", newThumbName });

      } catch (err) {
        // If download/upload failed, mark as removed? we choose to log and skip to avoid accidental deletes
        // but we can also remove if necessary. Here we log the failure and leave record for manual review.
        repaired.push({ fileName, fix: "Thumbnail regen failed", error: err.message });
        console.error(`Error regenerating thumb for ${fileName}:`, err.message);
      }
    }

    // Metadata repair (no downloads)
    let updated = false;
    const seo = generateSEOFromFilename(fileName);

    // Using fields that may exist in your schema: title, description, altText, category, tags
    if (!img.title || !img.title.toString().trim()) { img.title = seo.title; updated = true; }
    if (!img.description || !img.description.toString().trim()) { img.description = seo.description; updated = true; }
    if (!img.altText || !img.altText.toString().trim()) { img.altText = seo.alt; updated = true; }
    if (!img.category || !img.category.toString().trim()) { img.category = seo.category; updated = true; }
    if ((!img.tags || !Array.isArray(img.tags) || img.tags.length === 0) && Array.isArray(seo.tags)) {
      img.tags = seo.tags;
      updated = true;
    }

    if (updated) {
      await img.save();
      metadataFixed.push({ fileName, fix: "Metadata repaired" });
    }
  }));

  // wait all tasks
  await Promise.all(tasks);

  // Write logs
  const ts = Date.now();
  fs.writeFileSync(path.join(logsDir, `removed_${ts}.json`), JSON.stringify(removed, null, 2));
  fs.writeFileSync(path.join(logsDir, `repaired_${ts}.json`), JSON.stringify(repaired, null, 2));
  fs.writeFileSync(path.join(logsDir, `metadata_fixed_${ts}.json`), JSON.stringify(metadataFixed, null, 2));

  console.log("✅ Cleanup complete.");
  console.log(`Removed: ${removed.length}, Repaired: ${repaired.length}, Metadata fixed: ${metadataFixed.length}`);
  console.log(`Logs: ${logsDir}`);

  // close mongoose
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

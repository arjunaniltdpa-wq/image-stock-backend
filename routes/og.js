import express from "express";
import sharp from "sharp";
import Image from "../models/Image.js";
import fetch from "node-fetch";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.sendStatus(404);

    const idMatch = slug.match(/([a-f0-9]{24})$/i);

    const image = idMatch
      ? await Image.findById(idMatch[1]).lean()
      : await Image.findOne({ slug }).lean();

    if (!image || !image.fileName) {
      return res.redirect("https://pixeora.com/images/logo.png");
    }

    const src = image.thumbnailFileName
      ? `https://cdn.pixeora.com/${encodeURIComponent(image.thumbnailFileName)}`
      : `https://cdn.pixeora.com/${encodeURIComponent(image.fileName)}`;

    const r = await fetch(src);
    if (!r.ok) throw new Error("Image fetch failed");

    const buffer = Buffer.from(await r.arrayBuffer());

    // 🔥 PINTEREST SIZE (2:3)
    const og = await sharp(buffer)
      .resize(1000, 1500, { fit: "cover", position: "center" })
      .jpeg({ quality: 90 })
      .toBuffer();

    res.status(200);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", og.length);
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.end(og);

  } catch (err) {
    console.error("PINTEREST OG ERROR:", err);
    res.redirect("https://pixeora.com/images/logo.png");
  }
});

export default router;

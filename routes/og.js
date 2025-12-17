import express from "express";
import sharp from "sharp";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.sendStatus(404);

    // Match Mongo ObjectId if present
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

    // 🚨 VERY IMPORTANT
    if (!r.ok) {
      console.error("OG fetch failed:", r.status, src);
      return res.redirect("https://pixeora.com/images/logo.png");
    }


    const buffer = Buffer.from(await r.arrayBuffer());

    const og = await sharp(buffer)
      .resize(1200, 630, { fit: "cover", position: "center" })
      .jpeg({ quality: 82 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(og);

  } catch (err) {
    console.error("OG IMAGE ERROR:", err);
    res.sendStatus(500);
  }
});

export default router;

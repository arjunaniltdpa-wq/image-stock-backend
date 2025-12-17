import express from "express";
import sharp from "sharp";
import fetch from "node-fetch";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.sendStatus(404);

    let image = await Image.findOne({ slug });
    if (!image) return res.sendStatus(404);

    const originalUrl =
      image.thumbnailUrl ||
      `https://cdn.pixeora.com/${encodeURIComponent(image.fileName)}`;

    const response = await fetch(originalUrl);
    if (!response.ok) return res.sendStatus(404);

    const buffer = await response.buffer();

    const ogBuffer = await sharp(buffer)
      .resize(1200, 630, { fit: "cover", position: "center" })
      .jpeg({ quality: 82 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );
    res.send(ogBuffer);
  } catch (err) {
    console.error("OG error:", err);
    res.sendStatus(500);
  }
});

export default router;

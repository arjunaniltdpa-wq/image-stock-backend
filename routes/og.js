import express from "express";
import sharp from "sharp";
import fetch from "node-fetch";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.sendStatus(404);

    const image = await Image.findOne({ slug }).lean();
    if (!image || !image.fileName) return res.sendStatus(404);

    const originalUrl =
      image.thumbnailUrl ||
      `https://cdn.pixeora.com/${encodeURIComponent(image.fileName)}`;

    const response = await fetch(originalUrl);
    if (!response.ok) return res.sendStatus(404);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ogBuffer = await sharp(buffer)
      .resize(1200, 630, { fit: "cover", position: "center" })
      .jpeg({ quality: 82 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );
    res.status(200).end(ogBuffer);
  } catch (err) {
    console.error("OG image error:", err);
    res.sendStatus(500);
  }
});

export default router;

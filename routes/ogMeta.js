import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.sendStatus(400);

    let img = await Image.findOne({ slug }).lean();
    if (!img) return res.sendStatus(404);

    res.json({
      title: img.title || "Free HD Image | Pixeora",
      description:
        img.description ||
        "Download free HD wallpapers and royalty-free stock images from Pixeora.",
      image: `https://api.pixeora.com/api/og?slug=${encodeURIComponent(slug)}`,
      url: `https://pixeora.com/photo/${slug}`,
    });
  } catch (err) {
    console.error("ogMeta error:", err);
    res.sendStatus(500);
  }
});

export default router;

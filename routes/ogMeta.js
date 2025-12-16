import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.sendStatus(400);

    const idMatch = slug.match(/([a-f0-9]{24})$/i);
    const imageId = idMatch ? idMatch[1] : null;

    let img = null;
    if (imageId) {
      img = await Image.findById(imageId).lean();
    }

    if (!img) return res.sendStatus(404);

    const fileName = img.fileName;
    const ogImage = `https://api.pixeora.com/og/${encodeURIComponent(fileName)}`;

    res.json({
      title: img.title || "Free HD Image",
      description:
        img.description ||
        "Download free HD wallpapers and royalty-free stock images.",
      image: ogImage,
      url: `https://pixeora.com/photo/${slug}`,
    });
  } catch (e) {
    res.sendStatus(500);
  }
});

export default router;

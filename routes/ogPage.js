import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {

    const raw = req.params.slug;

    const idMatch = raw.match(/([a-f0-9]{24})$/i);

    const cleanSlug = raw
      .replace(/-[a-f0-9]{24}$/i, "")
      .replace(/-pixeora$/i, "");

    let image = null;

    if (idMatch) {
      image = await Image.findById(idMatch[1]).lean();
    }

    if (!image) {
      image = await Image.findOne({ slug: cleanSlug }).lean();
    }

    if (!image) {
      return res.redirect("https://pixeora.com");
    }

    // URLs
    const previewUrl =
      `https://cdn.pixeora.com/${image.previewFileName || image.fileName}`;

    const originalUrl =
      `https://cdn.pixeora.com/${image.fileName}`;

    const thumbUrl = image.thumbnailFileName
      ? `https://cdn.pixeora.com/${image.thumbnailFileName}`
      : originalUrl;

    // OG
    const fullSlug = image.slug;

    const ogPinterest =
      `https://pixeora.com/api/og/pinterest?slug=${fullSlug}`;

    const ogDefault =
      `https://pixeora.com/api/og?slug=${fullSlug}`;

    // Dimensions
    const width = image.width || 1200;
    const height = image.height || 800;

    const isPortrait = height > width;

    const pinterestWidth = isPortrait ? 1000 : 1200;
    const pinterestHeight = isPortrait ? 1500 : 630;

    // SEO
    const title = image.title || "Free HD Image";

    const desc =
      image.description ||
      `Download ${title} in HD quality for free.`;

    // Related
    const related = await Image.find({
      _id: { $ne: image._id },
      keywords: { $in: image.keywords || [] }
    })
    .limit(20)
    .lean();

    // FINAL RENDER
    res.render("photo", {
      image,
      raw,
      title,
      desc,
      width,
      height,
      previewUrl,
      originalUrl,
      thumbUrl,
      keywords: image.keywords || [],
      related,
      ogPinterest,
      ogDefault,
      pinterestWidth,
      pinterestHeight
    });

  } catch (err) {

    console.error("OG PAGE ERROR:", err);

    res.redirect("https://pixeora.com");

  }
});

export default router;
import express from "express";
import fs from "fs";
import path from "path";
import Image from "../models/Image.js";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.join(__dirname, "../public/download.html");

router.get("/:slug", async (req, res) => {
  try {
    const raw = req.params.slug;

    const idMatch = raw.match(/([a-f0-9]{24})$/i);
    if (!idMatch) return res.redirect("/");

    const image = await Image.findById(idMatch[1]).lean();
    if (!image) return res.redirect("/");

    const fullSlug = `${image.slug}-${image._id}`;
    const previewUrl = image.previewUrl || image.url;

    let html = fs.readFileSync(TEMPLATE_PATH, "utf8");

    // 🔥 Replace ONLY the main image tag safely
    html = html.replace(
      /<img\s+id="download-image"[^>]*>/,
      `<img
          id="download-image"
          src="${previewUrl}"
          alt="${image.title} HD stock image"
          width="${image.width || 1200}"
          height="${image.height || 800}"
          loading="eager"
          fetchpriority="high">`
    );
    // 🔥 Inject OG + Canonical
    html = html.replace(
      `<meta name="robots" content="index, follow">`,
      `<meta name="robots" content="index, follow">
       <meta property="og:title" content="${image.title}">
       <meta property="og:description" content="${image.description || ""}">
       <meta property="og:image" content="${previewUrl}">
       <meta property="og:url" content="https://pixeora.com/photo/${fullSlug}">
       <link rel="canonical" href="https://pixeora.com/photo/${fullSlug}">`
    );

    // 🔥 Inject REAL IMAGE (replace placeholder)
    html = html.replace(
      `https://cdn.pixeora.com/seo-placeholder.jpg`,
      previewUrl
    );

    // 🔥 Inject REAL ALT
    html = html.replace(
      `alt="Loading image..."`,
      `alt="${image.title} HD stock image"`
    );

    res.status(200).send(html);

  } catch (err) {
    console.error("PHOTO PAGE ERROR:", err);
    res.redirect("/");
  }
});

export default router;
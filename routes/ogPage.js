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

    // 🔥 Replace TITLE
    html = html.replace(
      /Free HD Stock Image Download \| Pixeora/g,
      `${image.title} | Free HD Image – Pixeora`
    );

    // 🔥 Replace META DESCRIPTION
    html = html.replace(
      /Download free high-quality HD and 4K stock images for commercial and personal use./g,
      image.description || `Download ${image.title} in HD resolution.`
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
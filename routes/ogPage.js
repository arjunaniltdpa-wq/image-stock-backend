import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const raw = req.params.slug;

    const idMatch = raw.match(/([a-f0-9]{24})$/i);
    const cleanSlug = raw.replace(/-[a-f0-9]{24}$/i, "").replace(/-pixeora$/i, "");

    let image = null;
    if (idMatch) image = await Image.findById(idMatch[1]).lean();
    if (!image) image = await Image.findOne({ slug: cleanSlug }).lean();
    if (!image) return res.redirect("https://pixeora.com");

    const fullSlug = `${image.slug}-${image._id}`;

    // 🔥 OG IMAGES
    const ogPinterest = `https://pixeora.com/api/og/pinterest?slug=${fullSlug}`;
    const ogDefault = `https://pixeora.com/api/og?slug=${fullSlug}`;

    // 🔥 IMAGE DIMENSIONS (VERY IMPORTANT)
    const width = image.width || 1200;
    const height = image.height || 800;

    // 👉 detect orientation
    const isPortrait = height > width;

    // 👉 Pinterest prefers vertical → force only if portrait
    const pinterestWidth = isPortrait ? 1000 : 1200;
    const pinterestHeight = isPortrait ? 1500 : 630;

    // 🔥 SAFE TEXT
    const title = image.title || "Free HD Image";
    const desc = image.description || `Download ${title} in HD quality for free.`;

    res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">

<title>${title}</title>
<meta name="description" content="${desc}">

<link rel="canonical" href="https://pixeora.com/photo/${raw}">

<meta name="robots" content="index, follow">

<!-- OPEN GRAPH -->
<meta property="og:type" content="article">
<meta property="og:url" content="https://pixeora.com/photo/${raw}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">

<!-- 🔥 PINTEREST IMAGE -->
<meta property="og:image" content="${ogPinterest}">
<meta property="og:image:width" content="${pinterestWidth}">
<meta property="og:image:height" content="${pinterestHeight}">
<meta property="og:image:type" content="image/jpeg">

<!-- 🔥 DEFAULT IMAGE -->
<meta property="og:image" content="${ogDefault}">
<meta property="og:image:width" content="${width}">
<meta property="og:image:height" content="${height}">
<meta property="og:image:type" content="image/jpeg">

<meta name="twitter:card" content="summary_large_image">

<!-- 🔥 STRUCTURED DATA -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "name": "${title}",
  "description": "${desc}",
  "contentUrl": "https://cdn.pixeora.com/${image.previewFileName || image.fileName}",
  "width": ${width},
  "height": ${height},
  "url": "https://pixeora.com/photo/${raw}"
}
</script>

<style>
body {
  font-family: Arial, sans-serif;
  padding: 20px;
  text-align: center;
}
img {
  max-width: 100%;
  height: auto;
}
</style>
<script>
  window.location.replace("/download.html?slug=${raw}");
</script>
</head>

</html>`);

  } catch (err) {
    console.error("OG PAGE ERROR:", err);
    res.redirect("https://pixeora.com");
  }
});

export default router;
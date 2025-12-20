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

    // 🔥 OG images
    const ogPinterest = `https://pixeora.com/api/og/pinterest?slug=${image.slug}-${image._id}`;
    const ogDefault = `https://pixeora.com/api/og?slug=${image.slug}-${image._id}`;

    res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${image.title}</title>

<meta name="description" content="${image.description || ""}">

<link rel="canonical" href="https://pixeora.com/photo/${raw}">

<meta property="og:type" content="article">
<meta property="og:url" content="https://pixeora.com/photo/${raw}">
<meta property="og:title" content="${image.title}">
<meta property="og:description" content="${image.description || ""}">

<!-- 🔥 PINTEREST FIRST -->
<meta property="og:image" content="${ogPinterest}">
<meta property="og:image:width" content="1000">
<meta property="og:image:height" content="1500">
<meta property="og:image:type" content="image/jpeg">

<!-- 🔥 FACEBOOK / TWITTER FALLBACK -->
<meta property="og:image" content="${ogDefault}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">

<meta name="twitter:card" content="summary_large_image">

<!-- Optional but recommended -->
<meta property="fb:app_id" content="1234567890">

<script>
  window.location.replace("/download.html?slug=${raw}");
</script>
</head>
<body></body>
</html>`);

  } catch (err) {
    console.error("OG PAGE ERROR:", err);
    res.redirect("https://pixeora.com");
  }
});

export default router;

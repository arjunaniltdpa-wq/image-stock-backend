import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const raw = req.params.slug;

    // Extract Mongo ID if present
    const idMatch = raw.match(/([a-f0-9]{24})$/i);
    const slug = raw.replace(/-[a-f0-9]{24}$/i, "");

    let image = null;

    if (idMatch) {
      image = await Image.findById(idMatch[1]).lean();
    }

    if (!image) {
      image = await Image.findOne({ slug }).lean();
    }

    if (!image) {
      return res.redirect(302, `https://pixeora.com/photo/${raw}`);
    }

    const title = image.title || "Free HD Image | Pixeora";
    const description =
      image.description ||
      "Download high-quality free HD wallpapers and stock images from Pixeora.";

    const ogImage = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(
      slug
    )}`;

    const pageUrl = `https://pixeora.com/photo/${raw}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(title)}</title>

<meta property="og:type" content="article" />
<meta property="og:site_name" content="Pixeora" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(description)}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${ogImage}" />

<meta http-equiv="refresh" content="0;url=${pageUrl}" />
</head>
<body></body>
</html>`);
  } catch (err) {
    console.error("OG PAGE ERROR:", err);
    res.redirect(302, "https://pixeora.com");
  }
});

function escape(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;

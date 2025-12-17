import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const image = await Image.findOne({ slug }).lean();

    if (!image) {
      return res.redirect(302, `https://pixeora.com/photo/${slug}`);
    }

    const title = image.title || "Free HD Image | Pixeora";
    const description =
      image.description ||
      "Download high-quality free HD images from Pixeora.";

    const ogImage = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(
      slug
    )}`;

    const pageUrl = `https://pixeora.com/photo/${slug}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />

<title>${escapeHtml(title)}</title>

<meta property="og:type" content="article" />
<meta property="og:site_name" content="Pixeora" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${ogImage}" />

<meta http-equiv="refresh" content="0; url=${pageUrl}" />
</head>
<body></body>
</html>`);
  } catch (err) {
    res.redirect(302, `https://pixeora.com/photo/${req.params.slug}`);
  }
});

export default router;

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

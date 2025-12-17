import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/photo/:slug", async (req, res) => {
  try {
    const ua = req.headers["user-agent"] || "";

    const isBot =
      /facebookexternalhit|facebookcatalog|Facebot|MetaInspector|Twitterbot|Pinterestbot|Pinterest|Slackbot|WhatsApp|LinkedInBot|TelegramBot/i.test(
        ua
      );

    // 🚫 Humans should NOT see OG page
    if (!isBot) {
      return res.redirect(302, `/photo/${req.params.slug}`);
    }

    const { slug } = req.params;
    const img = await Image.findOne({ slug }).lean();
    if (!img) return res.status(404).send("Not found");

    const title = escapeHtml(img.title || "Free HD Image | Pixeora");
    const description = escapeHtml(
      img.description ||
        "Download free HD wallpapers and royalty-free stock images from Pixeora."
    );

    const ogImage = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(
      slug
    )}`;

    const canonicalUrl = `https://pixeora.com/photo/${slug}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>

<link rel="canonical" href="${canonicalUrl}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Pixeora" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${ogImage}" />
</head>
<body></body>
</html>`;

    return res.status(200).send(html);
  } catch (err) {
    console.error("OG page error:", err);
    return res.sendStatus(500);
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

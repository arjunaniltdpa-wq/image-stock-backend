import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isBot =
      ua.includes("facebook") ||
      ua.includes("twitter") ||
      ua.includes("pinterest") ||
      ua.includes("whatsapp") ||
      ua.includes("linkedin");

    const raw = req.params.slug;
    const idMatch = raw.match(/([a-f0-9]{24})$/i);
    const cleanSlug = raw
      .replace(/-[a-f0-9]{24}$/i, "")
      .replace(/-pixeora$/i, "");

    // 🧍 HUMAN → FRONTEND
    if (!isBot) {
      return res.sendFile("download.html", { root: "public" });
    }

    // 🤖 BOT → OG HTML
    let image = null;
    if (idMatch) image = await Image.findById(idMatch[1]).lean();
    if (!image) image = await Image.findOne({ slug: cleanSlug }).lean();
    if (!image) return res.redirect(302, "https://pixeora.com");

    const ogImage = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(
      image.slug + "-" + image._id
    )}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>

<title>${image.title}</title>

<meta property="og:type" content="article"/>
<meta property="og:title" content="${image.title}"/>
<meta property="og:description" content="${image.description || ""}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="https://pixeora.com/photo/${raw}"/>

<meta name="twitter:card" content="summary_large_image"/>

</head>
<body></body>
</html>`);
  } catch (err) {
    console.error("OG PAGE ERROR:", err);
    res.redirect(302, "https://pixeora.com");
  }
});

export default router;

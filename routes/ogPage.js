import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const idMatch = slug.match(/([a-f0-9]{24})$/i);
  const img = idMatch
    ? await Image.findById(idMatch[1]).lean()
    : await Image.findOne({ slug }).lean();

  if (!img) return res.sendStatus(404);

  const title = img.title || "Pixeora Image";
  const desc = img.description || "Free HD image from Pixeora";
  const url = `https://pixeora.com/photo/${slug}`;
  const image = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(slug)}`;

  res.send(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>

<meta property="og:type" content="article"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${image}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="${image}"/>

<meta http-equiv="refresh" content="0; url=${url}">
</head>
<body></body>
</html>`);
});

export default router;

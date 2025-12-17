router.get("/:slug", async (req, res) => {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const isBot =
    ua.includes("facebook") ||
    ua.includes("twitter") ||
    ua.includes("pinterest") ||
    ua.includes("whatsapp") ||
    ua.includes("linkedin");

  if (!isBot) {
    // HUMAN → FRONTEND
    return res.sendFile("download.html", { root: "public" });
  }

  // BOT → OG HTML
  const raw = req.params.slug;
  const idMatch = raw.match(/([a-f0-9]{24})$/i);
  const slug = raw.replace(/-[a-f0-9]{24}$/i, "");

  let image = null;
  if (idMatch) image = await Image.findById(idMatch[1]).lean();
  if (!image) image = await Image.findOne({ slug }).lean();

  if (!image) {
    return res.redirect(302, "https://pixeora.com");
  }

  const ogImage = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(
    image.slug
  )}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
<!doctype html>
<html>
<head>
<title>${image.title}</title>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${image.title}"/>
<meta property="og:description" content="${image.description || ""}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta http-equiv="refresh" content="0;url=https://pixeora.com/photo/${raw}">
</head>
<body></body>
</html>
  `);
});

router.get("/photo/:slug", async (req, res) => {
  const slug = req.params.slug;
  const idMatch = slug.match(/([a-f0-9]{24})$/i);
  if (!idMatch) return res.redirect(302, "https://pixeora.com");

  const img = await Image.findById(idMatch[1]).lean();
  if (!img) return res.redirect(302, "https://pixeora.com");

  const title = img.title || "Free HD Image | Pixeora";
  const desc = img.description || "Download royalty-free HD images.";
  const ogImg = `https://api.pixeora.com/api/og?slug=${encodeURIComponent(slug)}`;

  res.send(`<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:image" content="${ogImg}"/>
<meta property="og:url" content="https://pixeora.com/photo/${slug}"/>
</head>
<body></body>
</html>`);
});

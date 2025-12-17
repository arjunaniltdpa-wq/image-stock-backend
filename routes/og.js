router.get("/", async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.sendStatus(404);

    const idMatch = slug.match(/([a-f0-9]{24})$/i);
    let image = null;

    if (idMatch) {
      image = await Image.findById(idMatch[1]);
    }

    if (!image) {
      image = await Image.findOne({ slug });
    }

    if (!image) return res.sendStatus(404);

    const originalUrl =
      image.thumbnailUrl ||
      `https://cdn.pixeora.com/${encodeURIComponent(image.fileName)}`;

    const response = await fetch(originalUrl);
    if (!response.ok) return res.sendStatus(404);

    const buffer = await response.buffer();

    const ogBuffer = await sharp(buffer)
      .resize(1200, 630, { fit: "cover", position: "center" })
      .jpeg({ quality: 82 })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(ogBuffer);
  } catch (err) {
    console.error("OG error:", err);
    res.sendStatus(500);
  }
});

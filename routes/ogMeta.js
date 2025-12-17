router.get("/", async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.sendStatus(400);

    const idMatch = slug.match(/([a-f0-9]{24})$/i);
    let img = null;

    if (idMatch) {
      img = await Image.findById(idMatch[1]).lean();
    }

    if (!img) {
      img = await Image.findOne({ slug }).lean();
    }

    if (!img) return res.sendStatus(404);

    res.json({
      title: img.title || "Free HD Image | Pixeora",
      description:
        img.description ||
        "Download free HD wallpapers and royalty-free stock images from Pixeora.",
      image: `https://api.pixeora.com/og?slug=${encodeURIComponent(slug)}`,
      url: `https://pixeora.com/photo/${slug}`,
    });
  } catch {
    res.sendStatus(500);
  }
});

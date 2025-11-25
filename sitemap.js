import express from "express";
import Image from "./models/Image.js";

const router = express.Router();

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://pixeora.com";

    const images = await Image.find({}, "_id title uploadedAt").limit(500000);

    let urls = images.map(img => `
      <url>
        <loc>${baseUrl}/download.html?id=${img._id}</loc>
        <lastmod>${new Date(img.uploadedAt).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.80</priority>
      </url>
    `).join("");

    const xml = `
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>${baseUrl}</loc>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
        </url>

        ${urls}

      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(xml);

  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Error generating sitemap");
  }
});

export default router;

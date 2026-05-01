import express from "express";
import Image from "./models/Image.js";

const router = express.Router();

// ------------------------
// CONFIGURATION
// ------------------------
const SITE = "https://pixeora.com";
const API_SITE = "https://api.pixeora.com";  
const CDN = "https://cdn.pixeora.com";      
const IMAGES_PER_SITEMAP = 5000;

// Escape XML special characters
function escapeXML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Generate fallback slug
function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "image";
}

// ------------------------
// SITEMAP INDEX (MAIN)
// ------------------------
router.get("/sitemap.xml", async (req, res) => {
  const count = await Image.countDocuments();
  const pages = Math.ceil(count / IMAGES_PER_SITEMAP);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE}/sitemap-latest.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>

  <sitemap>
    <loc>${SITE}/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>

  <sitemap>
    <loc>${SITE}/sitemap-tools.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
`;

  for (let i = 1; i <= pages; i++) {
    xml += `
    <sitemap>
      <loc>${SITE}/sitemap-images-${i}.xml</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
    </sitemap>`;
  }


  xml += `</sitemapindex>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// STATIC PAGES
// ------------------------
router.get("/sitemap-static.xml", (req, res) => {
  const urls = [
    "/",
    "/legal.html",
    "/search.html",
    "/search.html?query=latest",
    "/search.html?query=popular",
    "/search.html?query=4k",
    "/search.html?query=wallpaper",
    "/search.html?query=nature",
    "/search.html?query=car"
  ];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  urls.forEach(url => {
    xml += `
  <url>
    <loc>${SITE}${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

router.get("/sitemap-latest.xml", async (req, res) => {
  try {
    const images = await Image.find({})
      .sort({ updatedAt: -1, uploadedAt: -1 })
      .limit(500)
      .lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    images.forEach(img => {
      const slug = `${img.slug}-${img._id}`;
      xml += `
      <url>
        <loc>https://pixeora.com/photo/${slug}</loc>
        <lastmod>${new Date(img.updatedAt || img.uploadedAt).toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);

  } catch (err) {
    res.status(500).send("Error");
  }
});

// ------------------------
// TOOLS PAGES
// ------------------------
router.get("/sitemap-tools.xml", (req, res) => {
  const tools = [
    "/upscale.html",
    "/bgremove.html",
    "/imagecompressor.html",
    "/formatconverter.html"
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  tools.forEach(tool => {
    xml += `
  <url>
    <loc>${SITE}${tool}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// DYNAMIC IMAGE SITEMAPS
// ------------------------
router.get("/sitemap-images-:page.xml", async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const priority = page === 1 ? "1.0" : "0.8";
    const skip = (page - 1) * IMAGES_PER_SITEMAP;

    res.header("Content-Type", "application/xml");

    // Start streaming XML
    res.write(`<?xml version="1.0" encoding="UTF-8"?>
<urlset 
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`);

    const cursor = Image.find({})
      .sort({ updatedAt: -1, uploadedAt: -1 })
      .skip(skip)
      .limit(IMAGES_PER_SITEMAP)
      .cursor();

      for await (const img of cursor) {
        // Use stored slug directly
        const baseSlug = img.slug || slugify(img.name);
        const cleanUrl = `${SITE}/photo/${baseSlug}-${img._id}`;

        const originalImage = img.fileName
          ? encodeURIComponent(img.fileName)
          : null;

        const previewImage = img.previewFileName
          ? encodeURIComponent(img.previewFileName)
          : null;

        const thumbImage = img.thumbnailFileName
          ? encodeURIComponent(img.thumbnailFileName)
          : null;

        const title = escapeXML(img.title || img.name || "Free HD Image");

        const caption = escapeXML(
          (img.description || img.title || "Free high resolution stock image from Pixeora").slice(0, 2000)
        );

        const lastmod = new Date(
          img.updatedAt || img.uploadedAt || Date.now()
        ).toISOString();

        // PRIORITY: preview > original
        const bestImage = previewImage || originalImage;

        res.write(`
          <url>
            <loc>${cleanUrl}</loc>
            <lastmod>${lastmod}</lastmod>
            <changefreq>daily</changefreq>
            <priority>${priority}</priority>

            <image:image>
              ${bestImage ? `<image:loc>${CDN}/${bestImage}</image:loc>` : ""}
              ${thumbImage ? `<image:thumbnail_loc>${CDN}/${thumbImage}</image:thumbnail_loc>` : ""}
              <image:title>${title}</image:title>
              <image:caption>${caption}</image:caption>
              <image:license>${SITE}/legal.html</image:license>
            </image:image>
          </url>`);
      }

    res.write(`
    
</urlset>`);

    res.end();

  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).end();
  }
});

export default router;

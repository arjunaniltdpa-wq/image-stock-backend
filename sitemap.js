import express from "express";
import Image from "./models/Image.js";

const router = express.Router();

// ------------------------
// CONFIG
// ------------------------
const SITE = "https://pixeora.com";       // Frontend domain
const CDN = "https://cdn.pixeora.com";    // CDN bucket
const IMAGES_PER_SITEMAP = 5000;

// ------------------------
// SITEMAP INDEX
// ------------------------
router.get("/sitemap.xml", async (req, res) => {
  const count = await Image.countDocuments();
  const pages = Math.ceil(count / IMAGES_PER_SITEMAP);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE}/sitemap-static.xml</loc></sitemap>
  <sitemap><loc>${SITE}/sitemap-tools.xml</loc></sitemap>
`;

  // Dynamic image sitemaps (backend)
  for (let i = 1; i <= pages; i++) {
    xml += `<sitemap><loc>${SITE}/sitemap-images-${i}.xml</loc></sitemap>`;
  }

  xml += `</sitemapindex>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// STATIC PAGES SITEMAP
// ------------------------
router.get("/sitemap-static.xml", (req, res) => {
  const urls = [
    "/",               // homepage
    "/legal.html",
    "/search.html"
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  urls.forEach(url => {
    xml += `
  <url>
    <loc>${SITE}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === "/" ? "1.0" : "0.7"}</priority>
  </url>`;
  });

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// AI TOOLS SITEMAP
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
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// PAGINATED IMAGE SITEMAPS
// ------------------------
router.get("/sitemap-images-:page.xml", async (req, res) => {
  const page = parseInt(req.params.page) || 1;

  const images = await Image.find({})
    .skip((page - 1) * IMAGES_PER_SITEMAP)
    .limit(IMAGES_PER_SITEMAP);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset 
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
`;

  images.forEach(img => {
    const cleanUrl = `${SITE}/photo/${img.slug}-${img._id}`;
    const fileToShow = img.thumbnailFileName || img.fileName;

    xml += `
  <url>
    <loc>${cleanUrl}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>

    <image:image>
      <image:loc>${CDN}/${encodeURIComponent(fileToShow)}</image:loc>
      <image:title>${img.title || img.name || "Free HD Image"}</image:title>
      <image:caption>${img.description || img.title || ""}</image:caption>
    </image:image>

  </url>`;
  });

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

export default router;

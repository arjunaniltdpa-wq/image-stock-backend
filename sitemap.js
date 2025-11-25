import express from "express";
import Image from "./models/Image.js";

const router = express.Router();

// ------------------------
// CONFIG
// ------------------------
const DOMAIN = "https://pixeora.com";   // your website URL
const IMAGES_PER_SITEMAP = 5000;        // Google max limit

// ------------------------
// SITEMAP INDEX
// ------------------------
router.get("/sitemap.xml", async (req, res) => {
  const count = await Image.countDocuments();
  const pages = Math.ceil(count / IMAGES_PER_SITEMAP);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
    <sitemap>
      <loc>${DOMAIN}/sitemap-static.xml</loc>
    </sitemap>

    <sitemap>
      <loc>${DOMAIN}/sitemap-tools.xml</loc>
    </sitemap>
  `;

  for (let i = 1; i <= pages; i++) {
    xml += `
      <sitemap>
        <loc>${DOMAIN}/sitemap-images-${i}.xml</loc>
      </sitemap>
    `;
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
    "/search.html"
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  `;

  urls.forEach(url => {
    xml += `
      <url>
        <loc>${DOMAIN}${url}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>`;
  });

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// AI TOOLS
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
        <loc>${DOMAIN}${tool}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>`;
  });

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// IMAGES – PAGINATED
// ------------------------
router.get("/sitemap-images-:page.xml", async (req, res) => {
  const page = parseInt(req.params.page) || 1;

  const images = await Image.find({})
    .skip((page - 1) * IMAGES_PER_SITEMAP)
    .limit(IMAGES_PER_SITEMAP);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  `;

  images.forEach(img => {
    xml += `
      <url>
        <loc>${DOMAIN}/download.html?id=${img._id}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
      </url>`;
  });

  xml += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

export default router;

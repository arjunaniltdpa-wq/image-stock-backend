import express from "express";
import Image from "./models/Image.js";

const router = express.Router();

// ------------------------
// CONFIGURATION
// ------------------------
const SITE = "https://pixeora.com";       
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

  for (let i = 1; i <= pages; i++) {
    xml += `    <sitemap><loc>${SITE}/sitemap-images-${i}.xml</loc></sitemap>\n`;
  }

  xml += `</sitemapindex>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// STATIC PAGES
// ------------------------
router.get("/sitemap-static.xml", (req, res) => {
  const urls = ["/", "/legal.html", "/search.html"];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  urls.forEach(url => {
    xml += `
  <url>
    <loc>${SITE}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  xml += `\n</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
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
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  xml += `\n</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ------------------------
// DYNAMIC IMAGE SITEMAPS
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
    const fileToShow = encodeURIComponent(img.thumbnailFileName || img.fileName);
    const title = escapeXML(img.title || img.name || "Free HD Image");
    const caption = escapeXML(img.description || img.title || "");

    xml += `
  <url>
    <loc>${cleanUrl}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>

    <image:image>
      <image:loc>${CDN}/${fileToShow}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
    </image:image>
  </url>`;
  });

  xml += `\n</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

export default router;

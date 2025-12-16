import express from "express";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const router = express.Router();
const OG_DIR = path.join(process.cwd(), "public/og");

/* ----------------------------------
   OG IMAGE GENERATOR
   URL: /og/<filename>.jpg
---------------------------------- */
router.get("/:file", async (req, res) => {
  try {
    let file = req.params.file.replace(/[^a-zA-Z0-9._-]/g, "");

    // ✅ Force jpg only
    if (!file.endsWith(".jpg") && !file.endsWith(".jpeg")) {
      return res.sendStatus(404);
    }

    if (!fs.existsSync(OG_DIR)) {
      fs.mkdirSync(OG_DIR, { recursive: true });
    }

    const ogPath = path.join(OG_DIR, file);

    // ✅ Serve cached OG image
    if (fs.existsSync(ogPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return fs.createReadStream(ogPath).pipe(res);
    }

    // ✅ Fallback preview image
    const originalUrl =
      file === "preview.jpg"
        ? "https://cdn.pixeora.com/preview.jpg"
        : `https://cdn.pixeora.com/${encodeURIComponent(file)}`;

    const response = await fetch(originalUrl);
    if (!response.ok) return res.sendStatus(404);

    const buffer = Buffer.from(await response.arrayBuffer());

    const ogBuffer = await sharp(buffer)
      .resize(1200, 630, { fit: "cover", position: "center" })
      .jpeg({ quality: 82 })
      .toBuffer();

    fs.writeFileSync(ogPath, ogBuffer);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(ogBuffer);

  } catch (err) {
    console.error("OG ERROR:", err);
    res.sendStatus(500);
  }
});

export default router;

import express from "express";
import multer from "multer";
import { removeBackground } from "@imgly/background-removal";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("image_file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Run background removal
    const output = await removeBackground(req.file.buffer, {
      model: "medium",   // small | medium | large (medium is best)
      output: "image/png",
    });

    res.setHeader("Content-Type", "image/png");
    res.send(output);

  } catch (err) {
    console.error("BG REMOVE ERROR:", err);
    res.status(500).json({ error: "Failed to remove background" });
  }
});

export default router;

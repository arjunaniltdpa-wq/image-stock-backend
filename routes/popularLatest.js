import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const images = await Image.find({}).limit(5).lean();

    return res.json({
      ok: true,
      count: images.length,
      sample: images[0] || null
    });

  } catch (err) {
    console.error("POPULAR DEBUG ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
});

export default router;

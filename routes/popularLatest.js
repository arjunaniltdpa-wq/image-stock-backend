import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

// POPULAR + LATEST FIRST
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 36;
    const skip = (page - 1) * limit;

    const images = await Image.find({})
      .sort({ downloads: -1, _id: -1 }) // Popular + Latest first
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({ images });

  } catch (err) {
    console.error("POPULAR-LATEST ERROR:", err.message);
    return res.status(500).json({ error: "Failed to load popular images" });
  }
});

export default router;

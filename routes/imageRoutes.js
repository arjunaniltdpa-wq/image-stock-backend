import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

// GET images (with pagination)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Image.countDocuments();
    const images = await Image.find()
      .skip(skip)
      .limit(limit)
      .sort({ uploadedAt: -1 });

    res.json({
      page,
      total,
      totalPages: Math.ceil(total / limit),
      images: images.map(img => ({
        _id: img._id,
        name: img.name || img.fileName,
        url: img.url,
        uploadedAt: img.uploadedAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Search images
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const images = await Image.find({ name: { $regex: query, $options: "i" } })
      .limit(50)
      .sort({ uploadedAt: -1 });

    res.json(images.map(img => ({
      _id: img._id,
      name: img.name,
      url: img.url,
      uploadedAt: img.uploadedAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;

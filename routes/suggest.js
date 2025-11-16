import express from "express";
import Image from "../models/Image.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim().toLowerCase();
    if (!q || q.length < 2) return res.json([]);

    const regex = new RegExp("^" + q, "i");

    const results = await Image.find(
      {
        $or: [
          { title: regex },
          { name: regex },
          { tags: { $elemMatch: { $regex: regex } } },
          { keywords: { $elemMatch: { $regex: regex } } }
        ]
      },
      { title: 1 }
    )
      .limit(10)
      .lean();

    // Convert output: remove duplicates
    const suggestions = [...new Set(results.map(r => r.title))];

    res.json(suggestions);

  } catch (err) {
    console.log("Suggest error:", err);
    res.status(500).json({ error: "suggest failed" });
  }
});

export default router;

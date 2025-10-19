// routes/imageRoutes.js
import express from "express";
import Image from "../models/Image.js";
import B2 from "backblaze-b2";

const router = express.Router();

// Initialize B2
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY,
});

// Authorize B2
await b2.authorize();

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

    // Generate temporary URL for each image
    const imagesWithUrl = await Promise.all(
      images.map(async (img) => {
        const auth = await b2.getDownloadAuthorization({
          bucketId: process.env.BACKBLAZE_BUCKET_ID,
          fileName: img.fileName,
          validDurationInSeconds: 3600, // 1 hour
        });

        const url = `https://s3.us-west-004.backblazeb2.com/${process.env.BACKBLAZE_BUCKET_NAME}/${encodeURIComponent(
          img.fileName
        )}?Authorization=${auth.data.authorizationToken}`;

        return {
          _id: img._id,
          name: img.fileName,
          url,
          uploadedAt: img.uploadedAt,
        };
      })
    );

    res.json({
      page,
      total,
      totalPages: Math.ceil(total / limit),
      images: imagesWithUrl,
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
    const images = await Image.find({ fileName: { $regex: query, $options: "i" } })
      .limit(50)
      .sort({ uploadedAt: -1 });

    const imagesWithUrl = await Promise.all(
      images.map(async (img) => {
        const auth = await b2.getDownloadAuthorization({
          bucketId: process.env.BACKBLAZE_BUCKET_ID,
          fileName: img.fileName,
          validDurationInSeconds: 3600,
        });

        const url = `https://s3.us-west-004.backblazeb2.com/${process.env.BACKBLAZE_BUCKET_NAME}/${encodeURIComponent(
          img.fileName
        )}?Authorization=${auth.data.authorizationToken}`;

        return {
          _id: img._id,
          name: img.fileName,
          url,
          uploadedAt: img.uploadedAt,
        };
      })
    );

    res.json(imagesWithUrl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;

import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* =====================================================
   SEARCH
===================================================== */

router.get(
  "/",
  async (req, res) => {

    try {

      const rawQ =
      (req.query.q || "")
      .trim();

      if (!rawQ) {

        return res.json({
          images: [],
          hasMore: false
        });

      }

      const sort =
      (req.query.sort || "relevant")
      .toLowerCase();

      const page =
      Math.max(
        parseInt(req.query.page) || 1,
        1
      );

      const limit = 32;

      const skip =
      (page - 1) * limit;

      const images =
      await Image.find(

        {
          $text: {
            $search: rawQ
          }
        },

        {
          score: {
            $meta: "textScore"
          }
        }

      )

      .sort(

        sort === "popular"

        ? {
            downloads: -1,
            createdAt: -1
          }

        : sort === "new"

        ? {
            createdAt: -1
          }

        : {
            score: {
              $meta: "textScore"
            },
            downloads: -1,
            createdAt: -1
          }

      )

      .skip(skip)

      .limit(limit)

      .select(`
        _id
        slug
        title
        width
        height
        thumbnailFileName
        fileName
      `)

      .lean();

      const unique = [];
      const seen = new Set();

      for (const img of images) {

        if (
          !img.thumbnailFileName &&
          !img.fileName
        ) continue;

        if (
          seen.has(img.slug)
        ) continue;

        seen.add(img.slug);

        unique.push({

          _id: img._id,

          slug: img.slug,

          title: img.title,

          width: img.width,

          height: img.height,

          fileName:
          img.fileName,

          thumbnailFileName:
          img.thumbnailFileName

        });

      }

      return res.json({

        images: unique,

        hasMore:
        unique.length === limit

      });

    } catch (err) {

      console.error(
        "SEARCH ERROR:",
        err
      );

      res.status(500).json({

        error:
        "Search failed"

      });

    }

  }
);

export default router;
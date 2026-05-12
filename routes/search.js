import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const CDN =
process.env.R2_PUBLIC_BASE_URL;

/* =====================================================
   SEARCH FIRST
===================================================== */

router.get(
  "/first",
  async (req, res) => {

    try {

      const rawQ =
      (req.query.q || "")
      .trim();

      if (!rawQ) {

        return res.json({
          images: [],
          nextCursor: null
        });

      }

      const limit =
      Math.min(
        parseInt(req.query.limit) || 16,
        24
      );

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

      .sort({

        score: {
          $meta: "textScore"
        },

        downloads: -1,

        _id: -1

      })

      .select(`
        _id
        slug
        title
        width
        height
        thumbnailFileName
        fileName
      `)

      .limit(limit)

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

          fileName: img.fileName,

          thumbnailFileName:
          img.thumbnailFileName

        });

      }

      return res.json({

        images: unique,

        nextCursor:

        unique.length === limit
          ? unique[
              unique.length - 1
            ]._id
          : null

      });

    } catch (err) {

      console.error(
        "SEARCH FIRST ERROR:",
        err
      );

      res.status(500).json({

        error:
        "Search failed"

      });

    }

  }
);

/* =====================================================
   SEARCH NEXT
===================================================== */

router.get(
  "/next",
  async (req, res) => {

    try {

      const rawQ =
      (req.query.q || "")
      .trim();

      if (!rawQ) {

        return res.json({
          images: [],
          nextCursor: null
        });

      }

      const cursor =
      req.query.cursor || null;

      const limit =
      Math.min(
        parseInt(req.query.limit) || 16,
        20
      );

      const query = {

        $text: {
          $search: rawQ
        }

      };

      if (cursor) {

        query._id = {
          $lt: cursor
        };

      }

      const images =
      await Image.find(

        query,

        {
          score: {
            $meta: "textScore"
          }
        }

      )

      .sort({

        score: {
          $meta: "textScore"
        },

        downloads: -1,

        _id: -1

      })

      .select(`
        _id
        slug
        title
        width
        height
        thumbnailFileName
        fileName

      `)

      .limit(limit)

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

          fileName: img.fileName,

          thumbnailFileName:
          img.thumbnailFileName

        });

      }

      return res.json({

        images: unique,

        nextCursor:

        unique.length === limit
          ? unique[
              unique.length - 1
            ]._id
          : null

      });

    } catch (err) {

      console.error(
        "SEARCH NEXT ERROR:",
        err
      );

      res.status(500).json({

        error:
        "Next failed"

      });

    }

  }
);

export default router;
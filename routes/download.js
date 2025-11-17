// routes/download.js
import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/:file", async (req, res) => {
  try {
    const file = req.params.file;

    const fileUrl = `https://cdn.pixeora.com/${file}`;

    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    res.send(response.data);

  } catch (err) {
    res.status(404).send("File not found");
  }
});

export default router;

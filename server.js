import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import B2 from "backblaze-b2";
import multer from "multer";
import cors from "cors";
import imageRoutes from "./routes/imageRoutes.js"; // Import API routes
import Image from "./models/Image.js"; // Import Image model

dotenv.config();

const app = express();

// -------------------
// Middleware
// -------------------
app.use(cors({
  origin: "*", // Later you can restrict to your Vercel frontend URL
}));
app.use(express.json());

// -------------------
// MongoDB connection
// -------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// -------------------
// Backblaze B2 setup
// -------------------
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY
});

// -------------------
// Async init function
// -------------------
async function init() {
  try {
    // Authorize B2
    await b2.authorize();
    console.log("✅ Backblaze authorized");

    // -------------------
    // Multer setup for file uploads
    // -------------------
    const upload = multer({ storage: multer.memoryStorage() });

    // -------------------
    // Upload endpoint
    // -------------------
    app.post("/upload", upload.single("image"), async (req, res) => {
      try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        // Get upload URL from Backblaze
        const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.BACKBLAZE_BUCKET_ID });

        // Upload file to Backblaze
        const uploadResponse = await b2.uploadFile({
          uploadUrl: uploadUrlResponse.data.uploadUrl,
          uploadAuthToken: uploadUrlResponse.data.authorizationToken,
          fileName: file.originalname,
          data: file.buffer
        });

        // Generate public file URL
        const fileUrl = `${process.env.BACKBLAZE_ENDPOINT}/${uploadResponse.data.fileName}`;

        // Save metadata in MongoDB
        const imageDoc = new Image({
          name: file.originalname,
          url: fileUrl,
          uploadedAt: new Date()
        });
        await imageDoc.save();

        res.json({ message: "✅ Uploaded successfully", fileUrl });
      } catch (err) {
        console.error("❌ Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    });

    // -------------------
    // Image API routes for frontend
    // -------------------
    app.use("/api/images", imageRoutes);

    // -------------------
    // Start Server
    // -------------------
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

  } catch (err) {
    console.error("❌ Backblaze authorization failed:", err);
  }
}

// Initialize server
init();

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import B2 from "backblaze-b2";
import multer from "multer";
import cors from "cors";
import imageRoutes from "./routes/imageRoutes.js";
import Image from "./models/Image.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Backblaze B2 setup
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY
});

// Multer setup
const upload = multer({ storage: multer.memoryStorage() });

// Upload endpoint
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const uploadUrlResponse = await b2.getUploadUrl({ bucketId: process.env.BACKBLAZE_BUCKET_ID });
    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: file.originalname,
      data: file.buffer
    });

    // Save metadata in MongoDB
    const imageDoc = new Image({
      name: file.originalname,
      fileName: file.originalname,
      uploadedAt: new Date()
    });
    await imageDoc.save();

    res.json({ message: "✅ Uploaded successfully", fileName: file.originalname });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Proxy route for free-tier Backblaze
app.get("/api/images/file/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const bucketId = process.env.BACKBLAZE_BUCKET_ID;

    const auth = await b2.authorize();
    const downloadResponse = await b2.downloadFileByName({
      bucketName: process.env.BACKBLAZE_BUCKET_NAME,
      fileName: name
    });

    res.setHeader("Content-Type", downloadResponse.headers["content-type"]);
    res.send(downloadResponse.data);
  } catch (err) {
    console.error("❌ File proxy error:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// Image API routes
app.use("/api/images", imageRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Backend is live. Use your frontend on Vercel.");
});

// Initialize server
async function init() {
  try {
    await b2.authorize();
    console.log("✅ Backblaze authorized");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Backblaze authorization failed:", err);
  }
}

init();

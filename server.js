import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import B2 from "backblaze-b2";
import multer from "multer";
import imageRoutes from "./routes/imageRoutes.js"; // Import API routes
import Image from "./models/Image.js"; // Import Image model
import cors from "cors";

dotenv.config();

const app = express(); // <-- Initialize app first

app.use(cors({
  origin: "*", // You can later restrict to your Vercel URL
}));

app.use(express.json());

console.log("MONGO_URI:", process.env.MONGO_URI);

// -------------------
// 1️⃣ MongoDB connection
// -------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// -------------------
// 2️⃣ Backblaze B2 setup
// -------------------
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID, // Backblaze Dashboard-ൽ നിന്നുള്ള Key ID
  applicationKey: process.env.BACKBLAZE_APP_KEY   // Application Key
});

await b2.authorize(); // ✅ കീകൾ ശരിയാണെങ്കിൽ ഇത് സക്സസ്സ് ആവും


// -------------------
// 3️⃣ Async init function
// -------------------
async function init() {
  try {
    // Authorize Backblaze
    await b2.authorize();
    console.log("✅ Backblaze authorized");

    // -------------------
    // 4️⃣ Multer setup for file uploads
    // -------------------
    const upload = multer({ storage: multer.memoryStorage() });

    // -------------------
    // 5️⃣ Upload endpoint - automatic metadata save
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

        // Save metadata in MongoDB automatically
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
    // 6️⃣ API Routes for frontend
    // -------------------
    app.use("/api/images", imageRoutes);

    // -------------------
    // 7️⃣ Start Server
    // -------------------
    app.listen(process.env.PORT, () =>
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    );

  } catch (err) {
    console.error("❌ Backblaze authorization failed:", err);
  }
}

init();

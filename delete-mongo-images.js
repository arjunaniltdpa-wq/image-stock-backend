import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Image from "./models/Image.js";

async function deleteImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Image.deleteMany({});
    console.log("✔ All image documents deleted from MongoDB.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Mongo Error:", err.message);
    process.exit(1);
  }
}

deleteImages();

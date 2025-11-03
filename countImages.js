import mongoose from "mongoose";
import dotenv from "dotenv";
import Image from "./models/Image.js";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const total = await Image.countDocuments();
    console.log(`🖼️ Total images in MongoDB: ${total}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

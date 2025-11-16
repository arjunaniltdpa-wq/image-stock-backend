import dotenv from "dotenv";
dotenv.config();

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function deleteAll() {
  try {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
      })
    );

    if (!list.Contents || list.Contents.length === 0) {
      console.log("No files found in R2 bucket.");
      return;
    }

    const objects = list.Contents.map(obj => ({ Key: obj.Key }));

    await s3.send(
      new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Delete: { Objects: objects },
      })
    );

    console.log("✔ All files deleted from R2 bucket.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

deleteAll();

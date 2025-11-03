import B2 from "backblaze-b2";
import dotenv from "dotenv";
dotenv.config();

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY,
});

const fileName = "bus-city-volvo-000001.jpg"; // change to exact file name

(async () => {
  try {
    await b2.authorize();
    const auth = await b2.getDownloadAuthorization({
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
      fileNamePrefix: fileName,
      validDurationInSeconds: 3600,
    });

    const signedUrl = `${process.env.BACKBLAZE_BASE_URL}${encodeURIComponent(fileName)}?Authorization=${auth.data.authorizationToken}`;
    console.log("✅ Signed URL:", signedUrl);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();

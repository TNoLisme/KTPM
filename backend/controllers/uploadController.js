// backend/controllers/uploadController.js
const cloudinary = require("cloudinary").v2;

// GET /api/v1/upload/get_upload_signature?folder=products
exports.getUploadSignature = (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    // FE có thể truyền ?folder=brands / products, default:
    const folder = req.query.folder || "ktpm_uploads";

    const paramsToSign = { timestamp, folder };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      cloudName: process.env.CLOUDINARY_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Cannot generate upload signature" });
  }
};

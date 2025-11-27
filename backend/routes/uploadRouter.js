// backend/routes/uploadRouter.js
const express = require("express");
const { getUploadSignature } = require("../controllers/uploadController");
const { isAuthenticatedUser } = require("../middlewares/auth");

const router = express.Router();

// Valet key API – cần đăng nhập
router.get("/get_upload_signature", isAuthenticatedUser, getUploadSignature);

module.exports = router;

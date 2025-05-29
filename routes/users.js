const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  userSignUp,
  verifyEmail,
  loginUser,
  resendEmail,
  forgotPassword,
  resetPassword,
  getUser,
  updateUser,
  loginPhoto,
  loginAdmin,
  listPhotoGrapher,
  listCustomers,
  deleteUser
} = require("../controllers/users");
const authenticateUser = require("../middleware/authMiddleware");
const uploadImage = require("../middleware/s3Upload");

router.post("/signup", userSignUp);
router.post("/login", loginUser);
router.post("/login-photographer", loginPhoto);
router.post("/login-admin", loginAdmin);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-email-verification", resendEmail);
router.post("/list-photographers", listPhotoGrapher);
router.post("/list-customers", listCustomers);
router.post("/delete-user", deleteUser);
router.get(
  "/get_user",
  authenticateUser(["photographer", "user", "admin"]),
  getUser
);
router.put(
  "/update/:id",
  authenticateUser(["photographer", "user", "admin"]),
  (req, res, next) => {
    uploadImage.single("profile")(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ status: false, message: err.message });
      } else if (err) {
        return res.status(400).json({ status: false, message: err.message });
      }
      next();
    });
  },
  updateUser
);

module.exports = router;

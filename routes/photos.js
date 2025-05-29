const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const userAuthenticate = require("../middleware/userAuthenticate");

const uploadImage = require("../middleware/s3PhotoUpload");
const {
  photoUploadImages,
  getGallery,
  homeGallery,
  addRatings,
  addLikes,
  addFavorites,
  removeLikes,
  removeFavorites,
  downloadPhoto,
  fetchGallery,
  myFavoritesList,
  usersLikePhoto,
  usersFavoritePhoto,
  usersPurchasedPhoto,
  usersRatePhoto,
  updatePhoto,
  staticsPhoto,
  photoGrapherSummary,
  deleteAPhoto
} = require("../controllers/photos");

router.post(
  "/",
  authenticateUser(["photographer"]),
  uploadImage.array("photos", 5),
  photoUploadImages
);

router.post("/get_gallery", authenticateUser(["photographer"]), getGallery);
router.post("/home-gallery", userAuthenticate(), homeGallery);
router.post("/fetch-gallery", userAuthenticate(), fetchGallery);

router.post("/add-rating", authenticateUser(["user"]), addRatings);
router.post("/add-likes", authenticateUser(["user"]), addLikes);
router.post("/add-favorites", authenticateUser(["user"]), addFavorites);
router.post("/remove-likes", authenticateUser(["user"]), removeLikes);
router.post("/remove-favorites", authenticateUser(["user"]), removeFavorites);
router.post("/my-favorites-list", authenticateUser(["user"]), myFavoritesList);
router.post("/liked_users", authenticateUser(["photographer"]), usersLikePhoto);
router.post("/rate_users", authenticateUser(["photographer"]), usersRatePhoto);
router.post(
  "/purchased_users",
  authenticateUser(["photographer"]),
  usersPurchasedPhoto
);
router.post(
  "/favorite_users",
  authenticateUser(["photographer"]),
  usersFavoritePhoto
);

router.put("/update/:id", authenticateUser(["photographer"]), updatePhoto);
router.post("/statics", authenticateUser(["photographer"]), staticsPhoto);
router.get("/photographers/:id", photoGrapherSummary);
router.delete("/delete/:id", deleteAPhoto);

router.get("/download", downloadPhoto);

module.exports = router;

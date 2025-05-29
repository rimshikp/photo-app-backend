const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  allEvents,
} = require("../controllers/events");
const authenticateUser = require("../middleware/authMiddleware");
const uploadImage = require("../middleware/s3Upload");

router.post(
  "/",
  authenticateUser(["photographer"]),
  (req, res, next) => {
    uploadImage.single("images")(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ status: false, message: err.message });
      } else if (err) {
        return res.status(400).json({ status: false, message: err.message });
      }
      next();
    });
  },
  createEvent
);
router.put(
  "/:id",
  authenticateUser(["photographer"]),
  (req, res, next) => {
    uploadImage.single("images")(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ status: false, message: err.message });
      } else if (err) {
        return res.status(400).json({ status: false, message: err.message });
      }
      next();
    });
  },
  updateEvent
);
router.delete("/:id", authenticateUser(["photographer"]), deleteEvent);
router.post("/list", authenticateUser(["photographer"]), getAllEvents);
router.post("/allevents", allEvents);

module.exports = router;

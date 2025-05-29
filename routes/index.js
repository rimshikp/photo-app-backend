const express = require("express");
const router = express.Router();

const userRoutes = require("./users");
const eventsRoutes = require("./events");
const photosRoutes = require("./photos");
const paymentRoutes = require("./payments");

router.use("/users", userRoutes);
router.use("/events", eventsRoutes);
router.use("/photos", photosRoutes);
router.use("/payments", paymentRoutes);

module.exports = router;

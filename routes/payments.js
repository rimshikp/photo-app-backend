const express = require("express");
const router = express.Router();
const {
  createOrder,
  verifyOrder,
  myOrder,
} = require("../controllers/payments");
const authenticateUser = require("../middleware/authMiddleware");

router.post("/create", authenticateUser(["user"]), createOrder);
router.post("/verify", authenticateUser(["user"]), verifyOrder);
router.post("/my-orders", authenticateUser(["user"]), myOrder);

module.exports = router;

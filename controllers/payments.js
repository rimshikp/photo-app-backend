require("dotenv").config();

const crypto = require("crypto");
const axios = require("axios");
const razorpay = require("razorpay");
const User = require("../models/users");
const Order = require("../models/orders");
const Photo = require("../models/photos");
const PurchasePhoto = require("../models/purchased_photo");

let razorpayInstance;
try {
  razorpayInstance = new razorpay({
    key_id: "rzp_test_W6FMLPfJeo1u3a",
    key_secret: "kRx699VfTRmRoi06cmW5iaEY",
  });
} catch (error) {
  console.error("Razorpay initialization failed:", error);
  process.exit(1);
}

exports.createOrder = async (req, res) => {
  try {
    const { photoIds } = req.body;
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({
        status: false,
        message: "photoIds must be a non-empty array",
      });
    }
    const photos = await Photo.find({
      _id: { $in: photoIds },
    }).select("_id price title");

    if (photos.length !== photoIds.length) {
      const foundIds = photos.map((p) => p._id.toString());
      const missingIds = photoIds.filter((id) => !foundIds.includes(id));
      return res.status(404).json({
        status: false,
        message: "Some photos not found or inactive",
        missingIds,
      });
    }
    const totalAmount = photos
      .reduce((sum, photo) => {
        return sum + parseFloat(photo.price);
      }, 0)
      .toFixed(2);
    const receiptId = `ord_${Date.now().toString().slice(-6)}_${req.user.id
      .toString()
      .slice(-4)}`;
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: receiptId,
      notes: {
        userId: req.user.id,
        photoCount: photos.length,
        fullReceipt: `order_${Date.now()}_${req.user.id}`,
      },
      payment_capture: 1,
    });
    const newOrder = new Order({
      user_id: req.user.id,
      photos: photos.map((photo) => ({
        photoId: photo._id,
        price: photo.price,
      })),
      totalAmount,
      currency: "INR",
      razorpayOrderId: razorpayOrder.id,
      status: "created",
      billingDetails: {
        name: req.user.full_name,
        email: req.user.email,
      },
      receiptId: receiptId,
    });

    await newOrder.save();

    return res.status(201).json({
      status: true,
      data: {
        orderId: newOrder._id,
        amount: newOrder.totalAmount,
        currency: newOrder.currency,
        razorpay_order_id: razorpayOrder.id,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    console.error("Order creation error:", err);
    if (err.statusCode === 401) {
      return res.status(500).json({
        status: false,
        message: "Payment gateway authentication failed",
        internalError: "RAZORPAY_AUTH_FAILED",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Order creation failed",
      internalError: err.message,
    });
  }
};

exports.verifyOrder = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ status: false, message: "Missing required payment details" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", "kRx699VfTRmRoi06cmW5iaEY")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid signature" });
    }

    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "completed",
        completedAt: new Date(),
      },
      { new: true }
    );
    if (!order) {
      return res
        .status(404)
        .json({ status: false, message: "Order not found" });
    }

    for (const photo of order.photos) {
      const purchasedPhoto = new PurchasePhoto({
        photo_id: photo.photoId,
        order_id: order._id,
        purchased_by: req.user.id,
      });
      await purchasedPhoto.save();
    }

    res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.myOrder = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.body;
    const userId = req.user.id;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const totalOrders = await Order.countDocuments({ user_id: userId });

    const totalPages = Math.ceil(totalOrders / limitNumber);
    const data = await Order.find({ user_id: userId })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate({
        path: "photos.photoId",
        model: "photos",
        select:
          "title watermarkImageUrl price originalImageUrl compressedImageUrl tags",
      });
    res.status(200).json({
      success: true,
      data: data,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalOrders,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ status: false, message: "Server Error" });
  }
};
exports.downloadPhoto = async (req, res) => {
  try {
    const { photoId, userId } = req.query;

    const purchased = await PurchasePhoto.findOne({
      photo_id: photoId,
      purchased_by: userId,
    });
    if (!purchased) {
      return res
        .status(403)
        .json({ status: false, message: "Photo not purchased by user" });
    }

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res
        .status(404)
        .json({ status: false, message: "Photo not found" });
    }

    const response = await axios.get(photo.imageUrl, {
      responseType: "stream",
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${photo.title.replace(/\s+/g, "_")}.jpg"`
    );
    response.data.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res
      .status(500)
      .json({ status: false, message: "Failed to download photo" });
  }
};

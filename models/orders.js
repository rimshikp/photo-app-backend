const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    photos: [
      {
        photoId: {
          type: Schema.Types.ObjectId,
          ref: "photos",
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        downloadCount: {
          type: Number,
          default: 0,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },
    status: {
      type: String,
      enum: [
        "created",
        "attempted",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "created",
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: String,
    razorpaySignature: String,
    paymentMethod: {
      type: String,
      enum: ["razorpay", "wallet", "bank_transfer"],
      default: "razorpay",
    },
    downloadLimit: {
      type: Number,
      default: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    refundedAt: Date,
    billingDetails: {
      name: String,
      email: String,
      phone: String,
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
      },
      taxId: String,
    },

    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.virtual("isCompleted").get(function () {
  return ["paid", "refunded", "partially_refunded"].includes(this.status);
});

orderSchema.methods.canDownloadPhoto = function (photoId) {
  const photoItem = this.photos.find((p) => p.photoId.equals(photoId));
  if (!photoItem) return false;

  return this.isCompleted && photoItem.downloadCount < this.downloadLimit;
};
orderSchema.methods.recordDownload = function (photoId) {
  const photoItem = this.photos.find((p) => p.photoId.equals(photoId));
  if (photoItem && photoItem.downloadCount < this.downloadLimit) {
    photoItem.downloadCount += 1;
    return true;
  }
  return false;
};
orderSchema.index({ user: 1 });
orderSchema.index({ "photos.photoId": 1 });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("orders", orderSchema);

module.exports = Order;

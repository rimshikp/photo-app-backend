const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    photo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "photos",
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },

    purchased_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("purchased_photos", purchaseSchema);

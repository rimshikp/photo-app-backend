const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    photo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "photos",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ratings", ratingSchema);

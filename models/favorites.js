const mongoose = require("mongoose");

const favoritesSchema = new mongoose.Schema(
  {
    photo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "photos",
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("favorites", favoritesSchema);

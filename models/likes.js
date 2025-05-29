const mongoose = require("mongoose");

const likesSchema = new mongoose.Schema(
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

module.exports = mongoose.model("likes", likesSchema);

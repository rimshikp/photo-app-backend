const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
  {
    originalImageUrl: {
      type: String,
      required: true,
    },
    compressedImageUrl: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    watermarkImageUrl: {
      type: String,
      required: true,
    },
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "events",
      required: true,
    },
    metadata: {
      originalSize: Number,
      compressedSize: Number,
      width: Number,
      height: Number,
      format: String,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("photos", photoSchema);

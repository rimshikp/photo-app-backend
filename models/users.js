const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
    },
    password: {
      type: String,
    },
    is_email_verified: {
      type: Boolean,
      default: false,
    },
    profile: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "user", "photographer"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("users", userSchema);

require("dotenv").config();

const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../models/users");
const sendEmail = require("../config/sendEmail");
const {JWT_SECRET,APP_URL} = require("../config");
exports.userSignUp = async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;
    if (!full_name || !email || !password) {
      return res
        .status(400)
        .json({ status: false, message: "Please fill all required fileds." });
    }
    if (!role) {
      return res
        .status(400)
        .json({ status: false, message: "Role is required." });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ status: false, message: "User already exists." });
    }
    const hashedPassword = await argon2.hash(password);
    const user = new User({
      full_name,
      email,
      role: role,
      password: hashedPassword,
    });
    await user.save();

    const emailToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1d",
    });

    const verifyUrl = `${APP_URL}verify-email?token=${emailToken}`;

    const html = `<p>Hello ${user.full_name},</p>
             <p>Please verify your email by clicking the link below:</p>
             <a href="${verifyUrl}">Verify Email</a>`;

    await sendEmail(user.email, "Email Verification", html);

    return res
      .status(200)
      .json({ status: true, message: "User registered successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ status: false, message: "Email is required." });
    }
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(400).json({ status: false, message: "User not found" });
    }

    const emailToken = jwt.sign(
      { userId: existingUser._id },
      JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );
    const passwordChange = `${APP_URL}reset-password?token=${emailToken}`;

    const html = `<p>Hello ${existingUser.full_name},</p>
             <p>You can update the password by clicking the link below:</p>
             <a href="${passwordChange}">Reset Password</a>`;

    await sendEmail(existingUser.email, "Reset Password", html);
    return res.status(200).json({
      status: true,
      message: "Reset password link sent your to email successfully",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password, token } = req.body;

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid token." });
    }
    const hashedPassword = await argon2.hash(password);
    user.password = hashedPassword;
    await user.save();

    return res
      .status(200)
      .json({ status: true, message: "Password updated successfully!." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.resendEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ status: false, message: "Email is required" });
    }
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(400)
        .json({ status: false, message: "User not found." });
    }

    const emailToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1d",
    });

    const verifyUrl = `${APP_URL}verify-email?token=${emailToken}`;

    const html = `<p>Hello ${user.full_name},</p>
             <p>Please verify your email by clicking the link below:</p>
             <a href="${verifyUrl}">Verify Email</a>`;

    await sendEmail(user.email, "Email Verification", html);

    return res
      .status(200)
      .json({ status: true, message: "Email send successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userdata = await User.findOne({
      $and: [{ role: "admin" }, { email: email }],
    });

    if (!userdata) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password." });
    }

    const validPassword = await argon2.verify(userdata.password, password);
    if (!validPassword) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password." });
    }
    const token = jwt.sign(
      { userId: userdata._id, email: userdata.email, role: userdata.role },
      JWT_SECRET
    );
    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: userdata._id,
        full_name: userdata.full_name,
        email: userdata.email,
        role: userdata.role,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.loginPhoto = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userdata = await User.findOne({
      $and: [{ role: "photographer" }, { email: email }],
    });

    if (!userdata) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password." });
    }

    const validPassword = await argon2.verify(userdata.password, password);
    if (!validPassword) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password." });
    }

    if (!userdata.is_email_verified) {
      const emailToken = jwt.sign(
        { userId: userdata._id, role: userdata.role },
        JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      const verifyUrl = `${APP_URL}verify-email?token=${emailToken}`;

      const html = `<p>Hello ${userdata.full_name},</p>
             <p>Please verify your email by clicking the link below:</p>
             <a href="${verifyUrl}">Verify Email</a>`;

      await sendEmail(userdata.email, "Email Verification", html);
      return res.status(400).json({
        status: false,
        message: "Please verify you email, please check your email",
      });
    }

    const token = jwt.sign(
      { userId: userdata._id, email: userdata.email, role: userdata.role },
      JWT_SECRET
    );
    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: userdata._id,
        full_name: userdata.full_name,
        email: userdata.email,
        role: userdata.role,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userdata = await User.findOne({
      $and: [{ role: "user" }, { email: email }],
    });
    if (!userdata) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password." });
    }

    const validPassword = await argon2.verify(userdata.password, password);
    if (!validPassword) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password." });
    }

    if (!userdata.is_email_verified) {
      const emailToken = jwt.sign(
        { userId: userdata._id, role: userdata.role },
        JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      const verifyUrl = `${APP_URL}verify-email?token=${emailToken}`;

      const html = `<p>Hello ${userdata.full_name},</p>
             <p>Please verify your email by clicking the link below:</p>
             <a href="${verifyUrl}">Verify Email</a>`;

      await sendEmail(userdata.email, "Email Verification", html);
      return res.status(400).json({
        status: false,
        message: "Please verify you email, please check your email",
      });
    }

    const token = jwt.sign(
      { userId: userdata._id, email: userdata.email, role: userdata.role },
      JWT_SECRET
    );
    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: userdata._id,
        full_name: userdata.full_name,
        email: userdata.email,
        role: userdata.role,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid token." });
    }
    if (user.is_email_verified) {
      return res
        .status(400)
        .json({ status: false, message: "Email already verified." });
    }

    user.is_email_verified = true;
    await user.save();
    return res
      .status(200)
      .json({ status: true, message: "Email successfully verified!" });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getUser = async (req, res) => {
  try {
    const userdata = await User.findById(req.user.id);
    delete userdata.password;
    return res.status(200).json({ status: true, data: userdata });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid user." });
    }
    let updatedUser = await User.findByIdAndUpdate(
      id,
      {
        full_name,
        phone,
        profile: req.file ? req.file.location : undefined,
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.body;

    let where = {};
    if (search) {
      where = {
        $and: [
          {
            $or: [
              { full_name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { phone: { $regex: search, $options: "i" } },
            ],
          },
          { role: "user" },
        ],
      };
    } else {
      where = { role: "user" };
    }
    const total = await User.countDocuments(where);
    const events = await User.find(where)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: events,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};
exports.listPhotoGrapher = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.body;

    let where = {};
    if (search) {
      where = {
        $and: [
          {
            $or: [
              { full_name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { phone: { $regex: search, $options: "i" } },
            ],
          },
          { role: "photographer" },
        ],
      };
    } else {
      where = { role: "photographer" };
    }
    const total = await User.countDocuments(where);
    const events = await User.find(where)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: events,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.body.id);
    if (!deleted) {
      return res.status(400).json({ status: false, message: "User not found" });
    }
    return res
      .status(200)
      .json({ status: true, message: "User deleted successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

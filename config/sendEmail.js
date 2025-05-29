const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"Photo Gallery" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log("Email sent successfully to", to);
  } catch (error) {
    console.error("Failed to send email:", error.message);
    throw error;
  }
};

module.exports = sendEmail;

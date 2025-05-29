const { S3Client } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const multer = require("multer");
const path = require("path");
const {AWS_ACCESS_KEY_ID,AWS_REGION,AWS_S3_BUCKET_NAME,AWS_SECRET_ACCESS_KEY} =require('../config')

const s3 = new S3Client({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
  region: AWS_REGION,
});

const s3Storage = multerS3({
  s3: s3,
  bucket: "workfoto-photo-app",

  metadata: (req, file, cb) => {
    cb(null, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      uploadedBy: req.user.id.toString(),
    });
  },
  key: (req, file, cb) => {
    const userId = req.user.id;
    const fileName = `photos/original/${userId}/${Date.now()}_${
      file.originalname
    }`;
    cb(null, fileName);
  },
});

function sanitizeFile(file, cb) {
  const fileExts = [".png", ".jpg", ".jpeg", ".webp"];
  const extname = path.extname(file.originalname.toLowerCase());
  const mimetype = file.mimetype;

  if (fileExts.includes(extname)) {
    return cb(null, true);
  }
  cb(new Error(`File type ${extname} is not allowed`));
}

const uploadImage = multer({
  storage: s3Storage,
  fileFilter: (req, file, callback) => {
    sanitizeFile(file, callback);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

module.exports = uploadImage;

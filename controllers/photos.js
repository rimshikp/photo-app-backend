const sharp = require("sharp");
const mongoose = require("mongoose");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const Photo = require("../models/photos");
const User = require("../models/users");
const Event = require("../models/events");
const Likes = require("../models/likes");
const Favorites = require("../models/favorites");
const Ratings = require("../models/ratings");
const Order = require("../models/orders");
const axios = require("axios");
const path = require("path");
const {AWS_ACCESS_KEY_ID,AWS_S3_BUCKET_NAME,AWS_REGION,AWS_SECRET_ACCESS_KEY,} =require('../config')

const s3 = new S3Client({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey:AWS_SECRET_ACCESS_KEY,
  },
  region:AWS_REGION,
});

const watermarkImage = Buffer.from(`
  <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="50%" font-family="Arial" font-size="20" 
          fill="rgba(255,255,255,0.5)" text-anchor="middle" 
          dominant-baseline="middle" transform="rotate(-45 100 50)">
      ${"WorkFotos"}
    </text>
  </svg>
`);


const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};


exports.photoUploadImages = async (req, res) => {
  try {
    const { eventId, price, tags, title } = req.body;
    const uploaded_by = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No files uploaded" });
    }

    const eventExists = await Event.findById(eventId);
    if (!eventExists) {
      return res
        .status(404)
        .json({ status: false, message: "Event not found" });
    }

    if (isNaN(price)) {
      return res
        .status(400)
        .json({ status: false, message: "Price must be a number" });
    }
    if (parseFloat(price) <= 0) {
      return res
        .status(400)
        .json({ status: false, message: "Price must be greater than 0" });
    }
    const photos = await Promise.all(
      req.files.map(async (file) => {
        try {
          const getObjectParams = {
            Bucket: 'workfoto-photo-app',
            Key: file.key,
          };

          const command = new GetObjectCommand(getObjectParams);
          const response = await s3.send(command);
          const fileBuffer = await streamToBuffer(response.Body);
          // const url = await getSignedUrl(s3, command, {
          //   expiresIn: 3600,

          //   signableHeaders: new Set(),
          //   unsignableHeaders: new Set(),
          //   signingRegion:"us-east-1",
          //   signingService: "s3",
          // });

          


          // let fileBuffer;
          // try {
          //   const response = await axios.get(url, {
          //     responseType: "arraybuffer",
          //     timeout: 10000,
          //     validateStatus: function (status) {
          //       return status >= 200 && status < 300;
          //     },
          //   });
          //   fileBuffer = Buffer.from(response.data, "binary");
          // } catch (downloadError) {
          //   console.error(
          //     `Failed to download ${file.originalname} from S3:`,
          //     downloadError
          //   );
          //   throw new Error(`Failed to download ${file.originalname} from S3`);
          // }

          const originalImage = sharp(fileBuffer);
          const originalMetadata = await originalImage.metadata();

          const compressedBuffer = await originalImage
            .clone()
            .resize({
              width: 1200,
              height: 1200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({
              quality: 50,
              progressive: true,
              mozjpeg: true,
            })
            .toBuffer();

          const watermarkedBuffer = await originalImage
            .clone()
            .resize({
              width: 2000,
              height: 2000,
              fit: "inside",
              withoutEnlargement: true,
            })
            .composite([
              {
                input: watermarkImage,
                tile: true,
                blend: "over",
              },
            ])
            .jpeg({
              quality: 80,
              progressive: true,
              mozjpeg: true,
            })
            .toBuffer();

          const timestamp = Date.now();
          const fileExt = path.extname(file.originalname) || ".jpg";
          const baseName = path.basename(file.originalname, fileExt);
          const compressedKey = `photos/compressed/${uploaded_by}/${timestamp}_${baseName}.jpg`;
          const watermarkedKey = `photos/watermarked/${uploaded_by}/${timestamp}_${baseName}.jpg`;

          const [compressedUrl, watermarkedUrl] = await Promise.all([
            uploadToS3(compressedKey, compressedBuffer, "image/jpeg"),
            uploadToS3(watermarkedKey, watermarkedBuffer, "image/jpeg"),
          ]);

          const photo = new Photo({
            originalImageUrl: file.location,
            compressedImageUrl: compressedUrl,
            watermarkImageUrl: watermarkedUrl,
            uploaded_by,
            price: parseFloat(price),
            event_id: eventId,
            title: title,
            tags: tags,
            metadata: {
              originalSize: file.size,
              compressedSize: compressedBuffer.length,
              width: originalMetadata.width,
              height: originalMetadata.height,
              format: originalMetadata.format,
            },
          });

          await photo.save();

          await Event.findByIdAndUpdate(eventId, {
            $push: { photos: photo._id },
          });

          return photo;
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          throw new Error(
            `Failed to process ${file.originalname}: ${error.message}`
          );
        }
      })
    );

    res.status(201).json({
      success: true,
      count: photos.length,
      data: photos,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

async function uploadToS3(key, buffer, contentType) {
  try {
    const uploadParams = {
      Bucket: 'workfoto-photo-app',
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // ACL: "public-read",
      ACL: 'bucket-owner-full-control',
    };

    await s3.send(new PutObjectCommand(uploadParams));
    return `https://${"workfoto-photo-app"}.s3.${'us-east-1'}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error("Failed to upload to S3");
  }
}

exports.getGallery = async (req, res) => {
  try {
    const { page = 1, limit = 20, eventIds, search, user = "" } = req.body;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    if (isNaN(pageNumber)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid page number" });
    }
    if (isNaN(limitNumber)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid limit value" });
    }

    const query = {};
    let userId = "";
    if (req.user.role === "admin") {
      userId = user;
    } else {
      userId = req.user.id;
    }

    query.uploaded_by = userId;

    if (eventIds && eventIds.length > 0) {
      query.event_id = { $in: eventIds };
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $in: [search] } },
      ];
    }

    const totalPhotos = await Photo.countDocuments(query);

    const totalPages = Math.ceil(totalPhotos / limitNumber);
    const photos = await Photo.find(query)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("event_id", "name")
      .populate("uploaded_by", "full_name email profile");

    res.status(200).json({
      success: true,
      data: photos,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalPhotos,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.homeGallery = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      eventIds,
      sortBy = "createdAt",
      sortOrder = "desc",
      search = "",
    } = req.body;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    if (isNaN(pageNumber)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid page number" });
    }
    if (isNaN(limitNumber)) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid limit value" });
    }
    const userId = req?.user?.id;
    const query = {};
    if (eventIds && eventIds.length > 0) {
      query.event_id = { $in: eventIds };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $in: [search] } },
      ];
    }
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
    const totalPhotos = await Photo.countDocuments(query);

    const totalPages = Math.ceil(totalPhotos / limitNumber);
    const photos = await Photo.find(query)
      .sort(sortOptions)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("event_id", "name")
      .populate("uploaded_by", "full_name email profile");

    const photosWithCounts = await Promise.all(
      photos.map(async (photo) => {
        let isLike = 0;
        let isFavorites = 0;
        let isPurchased = 0;
        let myRatings = {};

        if (userId) {
          isLike = await mongoose.model("likes").countDocuments({
            $and: [{ user_id: userId }, { photo_id: photo._id }],
          });
          isFavorites = await mongoose.model("favorites").countDocuments({
            $and: [{ user_id: userId }, { photo_id: photo._id }],
          });

          myRatings = await mongoose
            .model("ratings")
            .findOne({ $and: [{ user_id: userId }, { photo_id: photo._id }] });

          isPurchased = await mongoose.model("orders").countDocuments({
            user_id: userId,
            "photos.photoId": photo._id,
            status: { $in: ["completed"] },
          });
        }

        const likesCount = await mongoose
          .model("likes")
          .countDocuments({ photo_id: photo._id });

        const likesUsers = await mongoose
          .model("likes")
          .find({ photo_id: photo._id })
          .populate("user_id", "full_name profile")
          .limit(4);

        const favoritesCount = await mongoose
          .model("favorites")
          .countDocuments({ photo_id: photo._id });

        const ratings = await mongoose
          .model("ratings")
          .find({ photo_id: photo._id });

        const averageRating =
          ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating.rating, 0) /
              ratings.length
            : 0;

        return {
          ...photo.toObject(),
          isLike,
          isFavorites,
          isPurchased,
          myRatings: myRatings?.rating,
          likesCount,
          favoritesCount,
          likesUsers,
          averageRating: parseFloat(averageRating.toFixed(1)),
          ratingsCount: ratings.length,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: photosWithCounts,
      totalPhotos,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalPhotos,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.fetchGallery = async (req, res) => {
  try {
    const { photo_id } = req.body;
    const userId = req?.user?.id;
    let d = await fetchPhotos(photo_id, userId);
    res.status(200).json({
      success: true,
      data: d,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const fetchPhotos = async (photo_id, userId) => {
  const photo = await Photo.findOne({ _id: photo_id })
    .populate("event_id", "name")
    .populate("uploaded_by", "full_name email profile");

  let isLike = 0;
  let isFavorites = 0;
  let myRatings = {};

  if (userId) {
    isLike = await mongoose.model("likes").countDocuments({
      $and: [{ user_id: userId }, { photo_id: photo._id }],
    });
    isFavorites = await mongoose.model("favorites").countDocuments({
      $and: [{ user_id: userId }, { photo_id: photo._id }],
    });

    myRatings = await mongoose
      .model("ratings")
      .findOne({ $and: [{ user_id: userId }, { photo_id: photo._id }] });
  }

  const likesCount = await mongoose
    .model("likes")
    .countDocuments({ photo_id: photo._id });

  const likesUsers = await mongoose
    .model("likes")
    .find({ photo_id: photo._id })
    .populate("user_id", "full_name profile")
    .limit(4);

  const favoritesCount = await mongoose
    .model("favorites")
    .countDocuments({ photo_id: photo._id });

  const ratings = await mongoose.model("ratings").find({ photo_id: photo._id });

  const averageRating =
    ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length
      : 0;

  let isPurchased = await mongoose.model("orders").countDocuments({
    "photos.photoId": photo._id,
    status: { $in: ["completed"] },
  });
  let d = {
    ...photo.toObject(),
    isLike,
    isFavorites,
    isPurchased,
    myRatings: myRatings?.rating,
    likesCount,
    favoritesCount,
    likesUsers,
    averageRating: parseFloat(averageRating.toFixed(1)),
    ratingsCount: ratings.length,
  };
  return d;
};

exports.addRatings = async (req, res) => {
  try {
    if (!req.body.photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    if (!req.body.rating) {
      return res
        .status(400)
        .json({ status: false, message: "Rating id is required." });
    }

    const userId = req.user.id;
    const ratings = new Ratings({
      photo_id: req.body.photo_id,
      user_id: userId,
      rating: req.body.rating,
    });
    await ratings.save();
    return res
      .status(200)
      .json({ status: true, message: "Rating updated successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.addFavorites = async (req, res) => {
  try {
    if (!req.body.photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }

    const userId = req.user.id;
    const favorites = new Favorites({
      photo_id: req.body.photo_id,
      user_id: userId,
    });
    await favorites.save();
    return res
      .status(200)
      .json({ status: true, message: "Favorites updated successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.addLikes = async (req, res) => {
  try {
    if (!req.body.photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }

    const userId = req.user.id;
    const likes = new Likes({
      photo_id: req.body.photo_id,
      user_id: userId,
    });
    await likes.save();
    return res
      .status(200)
      .json({ status: true, message: "Likes updated successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.removeLikes = async (req, res) => {
  try {
    if (!req.body.photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }

    const userId = req.user.id;

    await Likes.deleteOne({
      $and: [{ photo_id: req.body.photo_id }, { user_id: userId }],
    });
    return res
      .status(200)
      .json({ status: true, message: "Likes removed successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.removeFavorites = async (req, res) => {
  try {
    if (!req.body.photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }

    const userId = req.user.id;
    await Favorites.deleteOne({
      $and: [{ photo_id: req.body.photo_id }, { user_id: userId }],
    });

    return res
      .status(200)
      .json({ status: true, message: "Favorites updated successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.downloadPhoto = async (req, res) => {
  try {
    if (!req.query.photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    const userId = req.query.user;
    let photodata = await Photo.findById(req.query.photo_id);
    const response = await axios.get(photodata?.watermarkImageUrl, {
      responseType: "stream",
    });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="downloaded_image.jpg"`
    );
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.myFavoritesList = async (req, res) => {
  try {
    const userId = req.user.id;
    let data = await Favorites.find({ user_id: userId });
    let content = [];
    for (let x of data) {
      let d = await fetchPhotos(x?.photo_id, userId);
      content.push(d);
    }

    return res.status(200).json({ status: true, content });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.usersLikePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    let { photo_id, page = 1, limit = 10 } = req.body;

    if (!photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const totalLikes = await Likes.countDocuments({ photo_id: photo_id });

    const totalPages = Math.ceil(totalLikes / limitNumber);
    const photos = await Likes.find({ photo_id: photo_id })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("user_id", "full_name profile email");

    res.status(200).json({
      success: true,
      data: photos,
      totalLikes,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalLikes,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.usersFavoritePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    let { photo_id, page = 1, limit = 10 } = req.body;

    if (!photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const totalFavor = await Favorites.countDocuments({ photo_id: photo_id });

    const totalPages = Math.ceil(totalFavor / limitNumber);
    const photos = await Favorites.find({ photo_id: photo_id })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("user_id", "full_name profile email");

    res.status(200).json({
      success: true,
      data: photos,
      totalFavor,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalFavor,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.usersRatePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    let { photo_id, page = 1, limit = 10 } = req.body;

    if (!photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const totalRate = await Ratings.countDocuments({ photo_id: photo_id });
    const totalPages = Math.ceil(totalRate / limitNumber);
    const photos = await Ratings.find({ photo_id: photo_id })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("user_id", "full_name profile email");

    res.status(200).json({
      success: true,
      data: photos,
      totalRate,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalRate,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.usersPurchasedPhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    let { photo_id, page = 1, limit = 10 } = req.body;

    if (!photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const query = {
      $and: [{ "photos.photoId": photo_id }, { status: "completed" }],
    };
    const totalOrder = await Order.countDocuments(query);

    const totalPages = Math.ceil(totalOrder / limitNumber);
    const photos = await Order.find(query)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .populate("user_id", "full_name profile email");

    res.status(200).json({
      success: true,
      data: photos,
      totalOrder,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalOrder,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.updatePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    let { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    await Photo.findByIdAndUpdate(id, {
      ...req.body,
      updated_by: req.user.id,
    });
    return res
      .status(200)
      .json({ status: true, message: "Photo updated successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.staticsPhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    let { photo_id } = req.body;

    if (!photo_id) {
      return res
        .status(400)
        .json({ status: false, message: "Photo id is required." });
    }
    const likesCount = await mongoose
      .model("likes")
      .countDocuments({ photo_id: photo._id });

    const favoritesCount = await mongoose
      .model("favorites")
      .countDocuments({ photo_id: photo._id });

    const ratings = await mongoose
      .model("ratings")
      .find({ photo_id: photo._id });

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating.rating, 0) /
          ratings.length
        : 0;

    let isPurchased = await mongoose.model("orders").countDocuments({
      user_id: userId,
      "photos.photoId": photo._id,
      status: { $in: ["completed"] },
    });

    return res.status(200).json({
      status: true,
      data: {
        purchasedCount: isPurchased,
        averageRating,
        favoritesCount,
        likesCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.photoGrapherSummary = async (req, res) => {
  try {
    let { id } = req.params;
    let content = await User.findOne({ _id: id }).lean();
    let totalImages = await Photo.countDocuments({ uploaded_by: id });

    const photographerPhotos = await Photo.find({ uploaded_by: id }).select(
      "_id"
    );
    const photoIds = photographerPhotos.map((photo) => photo._id);

    const orders = await Order.find({
      "photos.photoId": { $in: photoIds },
      status: "completed",
    });
    let totalEarnings = 0;
    let photoEarnings = {};

    orders.forEach((order) => {
      order.photos.forEach((photoItem) => {
        if (photoIds.some((id) => id.equals(photoItem.photoId))) {
          totalEarnings += photoItem.price;
          const photoIdStr = photoItem.photoId.toString();
          photoEarnings[photoIdStr] =
            (photoEarnings[photoIdStr] || 0) + photoItem.price;
        }
      });
    });

    const result = await Ratings.aggregate([
      {
        $match: { photo_id: { $in: photoIds } },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          ratedPhotosCount: { $addToSet: "$photo_id" },
        },
      },
      {
        $project: {
          averageRating: 1,
          totalRatings: 1,
          ratedPhotosCount: { $size: "$ratedPhotosCount" },
        },
      },
    ]);

    // if (result.length > 0) {
    //   return {
    //     averageRating: Math.round(result[0].averageRating * 10) / 10,
    //     totalRatings: result[0].totalRatings,
    //     ratedPhotosCount: result[0].ratedPhotosCount,
    //   };
    // }

    return res.status(200).json({
      data: {
        ...content,
        totalImages,
        totalEarnings,
        averageRating: Math.round(result[0].averageRating * 10) / 10,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

exports.deleteAPhoto = async (req, res) => {
  try {
    let { id } = req.params;
    await Photo.deleteOne({ _id: id });
    return res
      .status(200)
      .json({ status: true, message: "Photo deleted successfully." });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
    return;
  }
};

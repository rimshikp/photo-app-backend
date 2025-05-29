const Event = require("../models/events");

exports.createEvent = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res
        .status(400)
        .json({ status: false, message: "Name is required." });
    }
    const eventName = await Event.findOne({
      $and: [{ name: name }, { created_by: req.user.id }],
    });
    if (eventName) {
      return res
        .status(400)
        .json({ status: false, message: "Name is already exists." });
    }
    const event = new Event({
      ...req.body,
      cover_photo: req.file ? req.file.location : undefined,
      created_by: req.user.id,
    });
    await event.save();
    return res
      .status(200)
      .json({ status: true, message: "Event created successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};
exports.updateEvent = async (req, res) => {
  try {
    const { name } = req.body;
    const event = await Event.findOne({ _id: req.params.id });
    if (!event) {
      return res
        .status(400)
        .json({ status: false, message: "Event not found" });
    }
    const eventName = await Event.findOne({
      $and: [
        { name: name },
        { created_by: req.user.id },
        { _id: { $ne: req.params.id } },
      ],
    });
    if (eventName) {
      return res
        .status(400)
        .json({ status: false, message: "Name is already exists." });
    }
    await Event.findByIdAndUpdate(req.params.id, {
      ...req.body,
      updated_by: req.user.id,
      ...(req?.file?.location && { cover_photo: req.file.location }),
    });
    return res
      .status(200)
      .json({ status: true, message: "Event updated successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(400)
        .json({ status: false, message: "Event not found" });
    }
    return res
      .status(200)
      .json({ status: true, message: "Event deleted successfully." });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.body;
    let searchFilter = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { short_desc: { $regex: search, $options: "i" } },
      ],
    };
    if (req.user.role !== "admin") {
      searchFilter = {
        $and: [searchFilter, { created_by: req.user.id }],
      };
    }
    const total = await Event.countDocuments(searchFilter);
    const events = await Event.find(searchFilter)
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
    console.log("err---", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.allEvents = async (req, res) => {
  try {
    const events = await Event.find({}).sort({ createdAt: -1 });
    res.json({
      data: events,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

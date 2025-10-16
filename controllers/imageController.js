import Image from "../models/imageModel.js";

// @desc    Get all images
// @route   GET /api/images
export const getImages = async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadedAt: -1 });
    res.json(images);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Upload a new image
// @route   POST /api/images
export const uploadImage = async (req, res) => {
  const { title, url, tags } = req.body;

  if (!title || !url) {
    return res.status(400).json({ message: "Title and URL are required" });
  }

  try {
    const newImage = new Image({ title, url, tags });
    const savedImage = await newImage.save();
    res.status(201).json(savedImage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

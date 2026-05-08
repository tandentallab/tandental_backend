const NhaCungCap = require("../models/NhaCungCap");

// GET /api/nha-cung-cap
const getAllNhaCungCap = async (req, res) => {
  try {
    const list = await NhaCungCap.find({}).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/nha-cung-cap/:id
const getNhaCungCapById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await NhaCungCap.findById(id);
    if (!item) return res.status(404).json({ message: "Not found" });
    return res.json(item);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/nha-cung-cap
const createNhaCungCap = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.ten_nha_cung_cap) {
      return res.status(400).json({ message: "ten_nha_cung_cap is required" });
    }

    const newItem = new NhaCungCap(payload);
    await newItem.save();
    return res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/nha-cung-cap/:id
const updateNhaCungCap = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const updated = await NhaCungCap.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: "Not found" });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE (soft) /api/nha-cung-cap/:id
const softDeleteNhaCungCap = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await NhaCungCap.findByIdAndUpdate(id, { is_actived: false }, { new: true });
    if (!updated) return res.status(404).json({ message: "Not found" });
    return res.json({ message: "Deleted", item: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllNhaCungCap,
  getNhaCungCapById,
  createNhaCungCap,
  updateNhaCungCap,
  softDeleteNhaCungCap,
};

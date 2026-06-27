const NhaCungCap = require("../models/NhaCungCap");

exports.createNhaCungCap = async (req, res) => {
  try {
    const data = await NhaCungCap.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllNhaCungCap = async (req, res) => {
  try {
    const data = await NhaCungCap.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNhaCungCap = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await NhaCungCap.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy nhà cung cấp" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteNhaCungCap = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await NhaCungCap.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy nhà cung cấp" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

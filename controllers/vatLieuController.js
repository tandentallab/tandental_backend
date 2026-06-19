const VatLieu = require("../models/VatLieu");

exports.createVatLieu = async (req, res) => {
  try {
    const data = await VatLieu.create(req.body);
    const populated = await VatLieu.findById(data._id).populate("nhaCungCap");
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ message: "Mã vật liệu đã tồn tại" });
    res.status(500).json({ message: err.message });
  }
};

exports.getAllVatLieu = async (req, res) => {
  try {
    const data = await VatLieu.find()
      .populate("nhaCungCap", "ten soDienThoai email")
      .sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateVatLieu = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await VatLieu.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
      runValidators: true,
      new: true,
    }).populate("nhaCungCap", "ten soDienThoai email");
    if (!updated)
      return res.status(404).json({ message: "Không tìm thấy vật liệu" });
    res.json(updated);
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ message: "Mã vật liệu đã tồn tại" });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteVatLieu = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await VatLieu.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy vật liệu" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

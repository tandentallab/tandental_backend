const NguoiLienHe = require("../models/NguoiLienHe");

exports.createNguoiLienHe = async (req, res) => {
  try {
    const data = await NguoiLienHe.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllNguoiLienHe = async (req, res) => {
  try {
    const data = await NguoiLienHe.find().populate("nhaKhoa");
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNguoiLienHe = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await NguoiLienHe.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true, // trả về dữ liệu sau khi update
        runValidators: true, // chạy validate schema
      }
    ).populate("nhaKhoa");

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy người liên hệ",
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
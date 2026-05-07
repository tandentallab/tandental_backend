const BenhNhan = require("../models/BenhNhan");

exports.createBenhNhan = async (req, res) => {
  try {
    const data = await BenhNhan.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllBenhNhan = async (req, res) => {
  try {
    const data = await BenhNhan.find().populate("nhaKhoa");
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBenhNhan = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await BenhNhan.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true, // trả về dữ liệu sau khi update
        runValidators: true, // chạy validate schema
      }
    ).populate("nhaKhoa");

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy bệnh nhân",
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
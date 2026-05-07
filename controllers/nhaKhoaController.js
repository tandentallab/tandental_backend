const NhaKhoa = require("../models/NhaKhoa");

exports.createNhaKhoa = async (req, res) => {
  try {
    const data = await NhaKhoa.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllNhaKhoa = async (req, res) => {
  try {
    const data = await NhaKhoa.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNhaKhoa = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await NhaKhoa.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true, // trả về dữ liệu sau khi update
        runValidators: true, // chạy validate schema
      }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy nha khoa",
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
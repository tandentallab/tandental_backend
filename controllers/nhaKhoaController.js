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

exports.updateSoDuDauKy = async (req, res) => {
  try {
    const { id } = req.params;
    const { thang, nam, soTien } = req.body;

    if (!thang || !nam || soTien === undefined) {
      return res.status(400).json({ message: "Thiếu thang, nam hoặc soTien" });
    }

    const updated = await NhaKhoa.findByIdAndUpdate(
      id,
      { $set: { soDuDauKy: { thang: Number(thang), nam: Number(nam), soTien: Number(soTien) } } },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Không tìm thấy nha khoa" });

    res.json({ success: true, data: updated });
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
        returnDocument: 'after', // trả về dữ liệu sau khi update
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
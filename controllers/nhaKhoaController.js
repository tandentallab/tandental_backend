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

    const nhaKhoa = await NhaKhoa.findById(id);
    if (!nhaKhoa) return res.status(404).json({ message: "Không tìm thấy nha khoa" });

    // Đảm bảo là mảng
    if (!Array.isArray(nhaKhoa.soDuDauKy)) nhaKhoa.soDuDauKy = [];

    // Tìm xem tháng/năm này đã có chưa
    const existingIndex = nhaKhoa.soDuDauKy.findIndex(
      (item) => item.thang === Number(thang) && item.nam === Number(nam)
    );

    if (existingIndex !== -1) {
      nhaKhoa.soDuDauKy[existingIndex].soTien = Number(soTien); // Update
    } else {
      nhaKhoa.soDuDauKy.push({ thang: Number(thang), nam: Number(nam), soTien: Number(soTien) }); // Thêm mới
    }

    await nhaKhoa.save();
    res.json({ success: true, data: nhaKhoa });
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
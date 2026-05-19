const BangGia = require("../models/BangGia");
const SanPham = require("../models/SanPham");

/* ================= GET ALL BẢNG GIÁ ================= */
// Lấy tất cả bảng giá từ tất cả nha khoa
exports.getAllBangGia = async (req, res) => {
  try {
    const sanPhams = await SanPham.find();

    const bangGia = await BangGia.find();

    const mapGia = {};
    bangGia.forEach((item) => {
      mapGia[item.sanPhamId.toString()] = item.donGia;
    });

    const result = sanPhams.map((sp) => {
      return {
        sanPhamId: sp._id,
        tenSanPham: sp.tenSanPham,
        loaiTinh: sp.loaiTinh,
        loaiSanPham: sp.loaiSanPham,
        nhomSanPham: sp.nhomSanPham,
        donGia: mapGia[sp._id.toString()] || sp.donGiaChung,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= UPSERT ================= */
// tạo hoặc cập nhật giá
exports.upsertBangGia = async (req, res) => {
  try {
    const { nhaKhoaId, sanPhamId, donGia, ghiChu } = req.body;

    const data = await BangGia.findOneAndUpdate(
      { nhaKhoaId, sanPhamId },
      { donGia, ghiChu },
      { returnDocument: "after", upsert: true }
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= GET FULL BẢNG GIÁ ================= */
// trả về: giá riêng nếu có, không thì giá chung
exports.getBangGiaByNhaKhoa = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;

    const sanPhams = await SanPham.find();

    const bangGia = await BangGia.find({ nhaKhoaId });

    const mapGia = {};
    bangGia.forEach((item) => {
      mapGia[item.sanPhamId.toString()] = item;
    });

    const result = sanPhams.map((sp) => {
      const giaRieng = mapGia[sp._id];

      return {
        sanPhamId: sp._id,
        tenSanPham: sp.tenSanPham,
        loaiTinh: sp.loaiTinh,
        loaiSanPham: sp.loaiSanPham,
        nhomSanPham: sp.nhomSanPham,

        donGia: giaRieng ? giaRieng.donGia : sp.donGiaChung,
        laGiaRieng: !!giaRieng,

        bangGiaId: giaRieng?._id || null,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= DELETE (RESET VỀ GIÁ CHUNG) ================= */
exports.deleteBangGia = async (req, res) => {
  try {
    const data = await BangGia.findByIdAndDelete(req.params.id);

    if (!data) {
      return res.status(404).json({ message: "Không tìm thấy" });
    }

    res.json({ message: "Đã reset về giá chung" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.applyBangGiaTemplate  = async (req, res) => {
  try {
    const {
      sourceNhaKhoaId,
      targetNhaKhoaId,
    } = req.body;

    // validate
    if (
      !sourceNhaKhoaId ||
      !targetNhaKhoaId
    ) {
      return res.status(400).json({
        message:
          "Thiếu sourceNhaKhoaId hoặc targetNhaKhoaId",
      });
    }

    // tránh apply chính nó
    if (
      sourceNhaKhoaId ===
      targetNhaKhoaId
    ) {
      return res.status(400).json({
        message:
          "Không thể áp dụng cho cùng nha khoa",
      });
    }

    // lấy bảng giá nguồn
    const sourceBangGia =
      await BangGia.find({
        nhaKhoaId: sourceNhaKhoaId,
      });

    // xóa bảng giá cũ của target
    await BangGia.deleteMany({
      nhaKhoaId: targetNhaKhoaId,
    });

    // clone dữ liệu
    const cloneData = sourceBangGia.map(
      (item) => ({
        nhaKhoaId: targetNhaKhoaId,
        sanPhamId: item.sanPhamId,
        donGia: item.donGia,
      })
    );

    // insert mới
    if (cloneData.length > 0) {
      await BangGia.insertMany(cloneData);
    }

    return res.json({
      success: true,
      message:
        "Áp dụng bảng giá thành công",
      total: cloneData.length,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

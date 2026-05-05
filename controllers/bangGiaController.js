const BangGia = require("../models/bangGia");
const SanPham = require("../models/sanPham");

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
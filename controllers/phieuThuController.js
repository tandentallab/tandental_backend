const PhieuThu = require("../models/PhieuThu");
const HoaDon = require("../models/HoaDon");

/* ================= TẠO PHIẾU THU ================= */
exports.createPhieuThu = async (req, res) => {
  try {
    const {
      hoaDon,
      ngayThu,
      soTienThu,
      noiDung,
      phuongThucThanhToan,
    } = req.body;

    const hd = await HoaDon.findById(hoaDon);
    if (!hd) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    }

    let tongThanhToan = soTienThu;


    let conThua = 0;

    // 🔥 nếu trả quá
    if (tongThanhToan > hd.conLai) {
      conThua = tongThanhToan - hd.conLai;
      tongThanhToan = hd.conLai;
    }

    // 🔥 cập nhật hóa đơn
    hd.daThanhToan += tongThanhToan;
    hd.conLai -= tongThanhToan;

    if (hd.conLai <= 0) {
      hd.conLai = 0;
      hd.trangThai = "Đã thanh toán";
    } else if (hd.daThanhToan > 0) {
      hd.trangThai = "Thanh toán một phần";
    } else {
      hd.trangThai = "Chưa thanh toán";
    }

    await hd.save();

    let duocKhauTru = soTienThu - conThua

    const phieuThu = await PhieuThu.create({
      hoaDon,
      ngayThu,
      soTienThu,
      duocKhauTru,
      conThua,
      noiDung,
      phuongThucThanhToan,
    });

    res.json({
      success: true,
      data: phieuThu,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// exports.getPhieuThuByHoaDon = async (req, res) => {
//   try {
//     const { hoaDonId } = req.params;

//     const data = await PhieuThu.find({ hoaDon: hoaDonId })
//       .populate("nhaKhoa")
//       .sort({ ngayThu: -1 });

//     res.json(data);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.deletePhieuThu = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const phieu = await PhieuThu.findById(id);
//     if (!phieu) {
//       return res.status(404).json({ message: "Không tìm thấy phiếu thu" });
//     }

//     const hd = await HoaDon.findById(phieu.hoaDon);

//     const tongHoanTac = phieu.soTienThu + phieu.duocKhauTru;

//     // 🔥 rollback hóa đơn
//     hd.daThanhToan -= tongHoanTac;
//     if (hd.daThanhToan < 0) hd.daThanhToan = 0;

//     hd.conLai += tongHoanTac;

//     if (hd.daThanhToan === 0) {
//       hd.trangThai = "Chưa thanh toán";
//     } else if (hd.daThanhToan < hd.thanhTien) {
//       hd.trangThai = "Thanh toán một phần";
//     } else {
//       hd.trangThai = "Đã thanh toán";
//     }

//     await hd.save();

//     await phieu.deleteOne();

//     res.json({
//       success: true,
//       message: "Xóa phiếu thu thành công",
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };
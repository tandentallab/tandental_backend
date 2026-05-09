const PhieuThu = require("../models/PhieuThu");
const HoaDon = require("../models/HoaDon");
const mongoose = require("mongoose");

/* ================= LẤY DANH SÁCH PHIẾU THU ================= */
exports.getAllPhieuThu = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, nhaKhoaId, dateFrom, dateTo } = req.query;

    const pipeline = [];

    // Date range filter
    if (dateFrom || dateTo) {
      const dateMatch = {};
      if (dateFrom) dateMatch.$gte = new Date(dateFrom);
      if (dateTo) dateMatch.$lte = new Date(dateTo);
      pipeline.push({ $match: { ngayThu: dateMatch } });
    }

    pipeline.push(
      { $lookup: { from: "hoadons", localField: "hoaDon", foreignField: "_id", as: "hoaDonInfo" } },
      { $unwind: { path: "$hoaDonInfo", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "nhakhoas", localField: "hoaDonInfo.nhaKhoa", foreignField: "_id", as: "nhaKhoaInfo" } },
      { $unwind: { path: "$nhaKhoaInfo", preserveNullAndEmptyArrays: true } },
    );

    // NhaKhoa filter
    if (nhaKhoaId) {
      pipeline.push({ $match: { "nhaKhoaInfo._id": new mongoose.Types.ObjectId(nhaKhoaId) } });
    }

    pipeline.push(
      { $lookup: { from: "staffs", localField: "nguoiTao", foreignField: "_id", as: "nguoiTaoInfo" } },
      { $unwind: { path: "$nguoiTaoInfo", preserveNullAndEmptyArrays: true } },
    );

    if (search && search.trim() !== "") {
      const keyword = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { soPhieuThu: { $regex: keyword, $options: "i" } },
            { "nhaKhoaInfo.hoVaTen": { $regex: keyword, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });

    const countPipeline = [...pipeline, { $count: "total" }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      PhieuThu.aggregate(countPipeline),
      PhieuThu.aggregate(dataPipeline),
    ]);

    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= TẠO PHIẾU THU ================= */
exports.createPhieuThu = async (req, res) => {
  try {
    const {
      hoaDon,
      ngayThu,
      soTienThu,
      noiDung,
      phuongThucThanhToan,
      nguoiTao,
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

    // Generate soPhieuThu
    const count = await PhieuThu.countDocuments();
    const year = new Date().getFullYear();
    const soPhieuThu = `PT${year}${String(count + 1).padStart(4, "0")}`;

    const phieuThu = await PhieuThu.create({
      soPhieuThu,
      hoaDon,
      nguoiTao: req.user?.id || req.user?._id || null,
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

/* ================= CẬP NHẬT PHIẾU THU ================= */
exports.updatePhieuThu = async (req, res) => {
  try {
    const { id } = req.params;
    const { ngayThu, phuongThucThanhToan, noiDung } = req.body;

    const phieuThu = await PhieuThu.findById(id);
    if (!phieuThu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu thu" });
    }

    if (ngayThu !== undefined) phieuThu.ngayThu = ngayThu;
    if (phuongThucThanhToan !== undefined) phieuThu.phuongThucThanhToan = phuongThucThanhToan;
    if (noiDung !== undefined) phieuThu.noiDung = noiDung;

    await phieuThu.save();
    res.json({ success: true, data: phieuThu });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= LẤY CHI TIẾT PHIẾU THU ================= */
exports.getPhieuThuById = async (req, res) => {
  try {
    const { id } = req.params;

    const phieuThu = await PhieuThu.findById(id)
      .populate({
        path: "hoaDon",
        populate: [
          {
            path: "nhaKhoa",
            select: "hoVaTen tenGiaoDich soDienThoai email moTa diaChiCuThe quanHuyen tinh quocGia",
          },
          {
            path: "danhSachDonHang.donHang",
            select: "bacSi benhNhan",
            populate: [
              { path: "bacSi", select: "hoVaTen" },
              { path: "benhNhan", select: "hoVaTen soDienThoai" },
            ],
          },
        ],
      })
      .populate("nguoiTao", "hoVaTen HoTenNV");

    if (!phieuThu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu thu" });
    }

    res.json({ success: true, data: phieuThu });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
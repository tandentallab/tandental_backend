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
      {
        $addFields: {
          _hoaDonIds: "$danhSachHoaDon.hoaDon",
        },
      },
      { $lookup: { from: "hoadons", localField: "_hoaDonIds", foreignField: "_id", as: "hoaDonInfoList" } },
      // hoaDonInfo = phần tử đầu tiên (để lấy nhaKhoa, backward compat)
      { $addFields: { hoaDonInfo: { $arrayElemAt: ["$hoaDonInfoList", 0] } } },
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

    // Enrich danhSachHoaDon with full hoaDon details (chỉ cho data pipeline, sau skip/limit để nhẹ)
    const countPipeline = [...pipeline, { $count: "total" }];
    const dataPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          danhSachHoaDon: {
            $map: {
              input: { $ifNull: ["$danhSachHoaDon", []] },
              as: "item",
              in: {
                soTienThanhToan: "$$item.soTienThanhToan",
                hoaDon: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ["$hoaDonInfoList", []] },
                        as: "hd",
                        cond: { $eq: ["$$hd._id", "$$item.hoaDon"] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
    ];

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
      danhSachHoaDon, // [{ hoaDon: id, soTienThanhToan: number }, ...]
      ngayThu,
      noiDung,
      phuongThucThanhToan,
    } = req.body;

    if (!danhSachHoaDon || !danhSachHoaDon.length) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất một hóa đơn" });
    }

    let tongTienThu = 0;
    let tongConThua = 0;
    let tongDuocKhauTru = 0;
    const danhSachLuu = [];

    // Cập nhật từng hóa đơn
    for (const item of danhSachHoaDon) {
      const hd = await HoaDon.findById(item.hoaDon);
      if (!hd) continue;

      // Snapshot trước khi thay đổi
      const giaTriHoaDon = hd.giaTriThanhToan || 0;
      const daTTruocLanNay = hd.daThanhToan || 0;
      const conLaiTruocLanNay = hd.conLai || 0;

      let soTien = Number(item.soTienThanhToan) || 0;
      let conThua = 0;
      if (soTien > hd.conLai) {
        conThua = soTien - hd.conLai;
        soTien = hd.conLai;
      }

      hd.daThanhToan += soTien;
      hd.conLai -= soTien;
      if (hd.conLai <= 0) {
        hd.conLai = 0;
        hd.trangThai = "Đã thanh toán";
      } else if (hd.daThanhToan > 0) {
        hd.trangThai = "Thanh toán một phần";
      } else {
        hd.trangThai = "Chưa thanh toán";
      }
      await hd.save();

      tongTienThu += soTien;
      tongConThua += conThua;
      tongDuocKhauTru += soTien;
      danhSachLuu.push({
        hoaDon: item.hoaDon,
        soTienThanhToan: soTien,
        giaTriHoaDon,
        daTTruocLanNay,
        conLaiTruocLanNay,
      });
    }

    // Generate soPhieuThu
    const ngayThuDate = new Date(ngayThu || Date.now());
    const yy = String(ngayThuDate.getFullYear()).slice(-2);
    const mm = String(ngayThuDate.getMonth() + 1).padStart(2, "0");
    const prefix = `TAN${yy}${mm}`;
    const count = await PhieuThu.countDocuments({ soPhieuThu: { $regex: `^${prefix}` } });
    const soPhieuThu = `${prefix}${String(count + 1).padStart(4, "0")}`;

    const phieuThu = await PhieuThu.create({
      soPhieuThu,
      danhSachHoaDon: danhSachLuu,
      nguoiTao: req.user?.id || req.user?._id || null,
      ngayThu,
      soTienThu: tongTienThu + tongConThua, // giữ tổng người nộp (kể cả thừa)
      duocKhauTru: tongDuocKhauTru,
      conThua: tongConThua,
      noiDung,
      phuongThucThanhToan,
    });

    res.json({ success: true, data: phieuThu });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= CẬP NHẬT PHIẾU THU ================= */
exports.updatePhieuThu = async (req, res) => {
  try {
    const { id } = req.params;
    const { ngayThu, phuongThucThanhToan, noiDung, soTienThu } = req.body;

    const phieuThu = await PhieuThu.findById(id);
    if (!phieuThu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu thu" });
    }

    if (ngayThu !== undefined) phieuThu.ngayThu = ngayThu;
    if (phuongThucThanhToan !== undefined) phieuThu.phuongThucThanhToan = phuongThucThanhToan;
    if (noiDung !== undefined) phieuThu.noiDung = noiDung;

    if (soTienThu !== undefined && Number(soTienThu) !== phieuThu.soTienThu) {
      const newTotal = Number(soTienThu);
      let remaining = newTotal;
      let tongKhauTru = 0;

      for (let i = 0; i < phieuThu.danhSachHoaDon.length; i++) {
        const item = phieuThu.danhSachHoaDon[i];
        const hd = await HoaDon.findById(item.hoaDon);
        if (!hd) continue;

        const maxForThisHD = item.conLaiTruocLanNay || 0;
        const newPay = Math.min(remaining, maxForThisHD);
        remaining = Math.max(0, remaining - newPay);
        tongKhauTru += newPay;

        hd.daThanhToan = (item.daTTruocLanNay || 0) + newPay;
        hd.conLai = Math.max(0, (item.conLaiTruocLanNay || 0) - newPay);

        if (hd.conLai <= 0) {
          hd.trangThai = "Đã thanh toán";
        } else if (hd.daThanhToan > 0) {
          hd.trangThai = "Thanh toán một phần";
        } else {
          hd.trangThai = "Chưa thanh toán";
        }
        await hd.save();

        phieuThu.danhSachHoaDon[i].soTienThanhToan = newPay;
      }

      phieuThu.soTienThu = newTotal;
      phieuThu.duocKhauTru = tongKhauTru;
      phieuThu.conThua = Math.max(0, newTotal - tongKhauTru);
      phieuThu.markModified("danhSachHoaDon");
    }

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

    const hoaDonPopulate = [
      { path: "nhaKhoa", select: "hoVaTen tenGiaoDich soDienThoai email moTa diaChiCuThe quanHuyen tinh quocGia" },
      {
        path: "danhSachSanPham.donHang",
        select: "bacSi benhNhan",
        populate: [
          { path: "bacSi", select: "hoVaTen" },
          { path: "benhNhan", select: "hoVaTen soDienThoai" },
        ],
      },
    ];

    const phieuThu = await PhieuThu.findById(id)
      .populate({ path: "danhSachHoaDon.hoaDon", populate: hoaDonPopulate })
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


// ================= LẤY PHIẾU THU THEO HÓA ĐƠN ID =================
exports.getPhieuThuByHoaDonId = async (
  req,
  res
) => {
  try {
    const { hoaDonId } = req.params;

    // validate ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(
        hoaDonId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Hoa đơn ID không hợp lệ",
      });
    }

    // tìm phiếu thu có chứa hóa đơn
    const danhSachPhieuThu =
      await PhieuThu.find({
        "danhSachHoaDon.hoaDon":
          hoaDonId,
      })
        .populate({
          path: "danhSachHoaDon.hoaDon",
          select:
            "soHoaDon thanhTien daThanhToan conLai trangThai",
        })
        .populate(
          "nguoiTao",
          "hoVaTen email"
        )
        .sort({
          ngayThu: -1,
        });

    res.json({
      success: true,
      count:
        danhSachPhieuThu.length,
      data: danhSachPhieuThu,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
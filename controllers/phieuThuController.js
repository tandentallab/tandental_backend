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
                daTTruocLanNay: "$$item.daTTruocLanNay",
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

/* ================= TẠO PHIẾU THU (THÁC NƯỚC CHUẨN) ================= */
/* ================= TẠO PHIẾU THU (TÔN TRỌNG PHÂN BỔ THỰC TẾ) ================= */
exports.createPhieuThu = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let phieuThuOutput;

    await session.withTransaction(async () => {
      // 🔥 BƯỚC 1: Bốc thêm mảng danhSachHoaDon do Frontend phân bổ gửi lên
      const { nhaKhoaId, soTienThu, ngayThu, noiDung, phuongThucThanhToan, danhSachHoaDon } = req.body;

      if (!nhaKhoaId || !soTienThu || Number(soTienThu) <= 0) {
        throw new Error("Thông tin thanh toán không hợp lệ");
      }

      if (!danhSachHoaDon || !danhSachHoaDon.length) {
        throw new Error("Danh sách hóa đơn phân bổ thanh toán không được trống");
      }

      let tongTienThuThucTe = Number(soTienThu);
      const danhSachLuu = [];

      const nhaKhoa = await mongoose.model("NhaKhoa").findById(nhaKhoaId).session(session);
      if (!nhaKhoa) throw new Error("Không tìm thấy Nha khoa");

      // 🔥 BƯỚC 2: DUYỆT THEO MẢNG PHÂN BỔ THỰC TẾ, KHÔNG CHƠI THÁC NƯỚC TỰ ĐỘNG NỮA
      for (const item of danhSachHoaDon) {
        const hdId = item.hoaDon;
        const tienTraChoHdNay = Number(item.soTienThanhToan || 0);

        // Nếu dòng hóa đơn này không được chia đồng nào thì bỏ qua
        if (tienTraChoHdNay <= 0) continue;

        // Tìm chính xác hóa đơn được chỉ định
        const hd = await HoaDon.findById(hdId).session(session);
        if (!hd) {
          throw new Error(`Không tìm thấy hóa đơn có ID: ${hdId}`);
        }

        const snapshotGiaTri = hd.giaTriThanhToan || 0;
        const snapshotDaTTruoc = hd.daThanhToan || 0;
        const snapshotConLaiTruoc = hd.conLai || 0;

        // Lưu đúng số tiền kế toán gõ tay ở dòng này
        hd.daThanhToan += tienTraChoHdNay;
        hd.conLai = Math.max(0, hd.giaTriThanhToan - hd.daThanhToan); // Tính dựa trên gốc giaTriThanhToan để triệt tiêu lệch số

        if (hd.conLai <= 0) hd.trangThai = "Đã thanh toán";
        else if (hd.daThanhToan > 0) hd.trangThai = "Thanh toán một phần";

        if (hd.congNoCuoiKy !== undefined) {
          hd.congNoCuoiKy = Math.max(0, (hd.congNoCuoiKy || 0) - tienTraChoHdNay);
        }

        await hd.save({ session });

        // Đẩy vào danh sách chi tiết của phiếu thu
        danhSachLuu.push({
          hoaDon: hd._id,
          soTienThanhToan: tienTraChoHdNay,
          giaTriHoaDon: snapshotGiaTri,
          daTTruocLanNay: snapshotDaTTruoc,
          conLaiTruocLanNay: snapshotConLaiTruoc,
        });
      }

      // Tính toán phần thừa thiếu dựa trên mảng thực tế đã lưu
      const tongKhauTruThucTe = danhSachLuu.reduce((sum, x) => sum + x.soTienThanhToan, 0);
      const conThua = Math.max(0, tongTienThuThucTe - tongKhauTruThucTe);

      const ngayThuDate = new Date(ngayThu || Date.now());
      const yy = String(ngayThuDate.getFullYear()).slice(-2);
      const mm = String(ngayThuDate.getMonth() + 1).padStart(2, "0");
      const prefix = `TAN${yy}${mm}`;

      const count = await PhieuThu.countDocuments({ soPhieuThu: { $regex: `^${prefix}` } }).session(session);
      const soPhieuThu = `${prefix}${String(count + 1).padStart(4, "0")}`;

      const newPhieuThu = new PhieuThu({
        soPhieuThu,
        danhSachHoaDon: danhSachLuu,
        nguoiTao: req.user?.id || req.user?._id || undefined,
        ngayThu: ngayThuDate,
        soTienThu: tongTienThuThucTe,
        duocKhauTru: tongKhauTruThucTe, // Số tiền thực tế phân bổ vào các bill
        tienTruVaoMigrate: 0,
        conThua: conThua,
        noiDung,
        phuongThucThanhToan,
      });

      await newPhieuThu.save({ session });
      phieuThuOutput = newPhieuThu;
    });

    res.json({ success: true, data: phieuThuOutput });
  } catch (err) {
    console.error("🚨 CHI TIẾT LỖI TẠO PHIẾU THU:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

exports.updatePhieuThu = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedPhieu;
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { ngayThu, phuongThucThanhToan, noiDung, danhSachHoaDon } = req.body;

      const phieuThu = await PhieuThu.findById(id).session(session);
      if (!phieuThu) throw new Error("Không tìm thấy phiếu thu");

      // 1. Cập nhật các thông tin cơ bản
      if (ngayThu !== undefined) phieuThu.ngayThu = ngayThu;
      if (phuongThucThanhToan !== undefined) phieuThu.phuongThucThanhToan = phuongThucThanhToan;
      if (noiDung !== undefined) phieuThu.noiDung = noiDung;

      // 2. Kế toán phân bổ lại tiền cho từng hóa đơn
      if (danhSachHoaDon && Array.isArray(danhSachHoaDon)) {

        // BƯỚC A: HOÀN TÁC TOÀN BỘ TIỀN CỦA PHIẾU THU CŨ
        for (const item of phieuThu.danhSachHoaDon) {
          const hd = await HoaDon.findById(item.hoaDon).session(session);
          if (hd) {
            hd.daThanhToan = Math.max(0, (hd.daThanhToan || 0) - (item.soTienThanhToan || 0));
            hd.conLai = Math.round((hd.giaTriThanhToan || 0) - hd.daThanhToan);

            if (hd.conLai <= 0) hd.trangThai = "Đã thanh toán";
            else if (hd.daThanhToan > 0) hd.trangThai = "Thanh toán một phần";
            else hd.trangThai = "Chưa thanh toán";

            await hd.save({ session });
          }
        }

        // BƯỚC B: ÁP DỤNG MỨC TIỀN MỚI CHO TỪNG HÓA ĐƠN
        let newTotal = 0;
        const danhSachLuuMoi = [];

        for (const item of danhSachHoaDon) {
          const hdId = item.hoaDon;
          const tienTra = Number(item.soTienThanhToan || 0);

          // Nếu kế toán sửa về 0đ thì bỏ qua hóa đơn này
          if (tienTra <= 0) continue;

          const hd = await HoaDon.findById(hdId).session(session);
          if (!hd) throw new Error(`Không tìm thấy hóa đơn: ${hdId}`);

          // Chặn bảo mật: Không cho phép rót tiền lố số nợ của Hóa đơn
          if (tienTra > hd.conLai) {
            throw new Error(`Hóa đơn ${hd.soHoaDon} chỉ còn nợ ${hd.conLai}, bạn không thể thanh toán ${tienTra}.`);
          }

          const snapshotGiaTri = hd.giaTriThanhToan || 0;
          const snapshotDaTTruoc = hd.daThanhToan || 0;
          const snapshotConLaiTruoc = hd.conLai || 0;

          // Rót tiền mới vào
          hd.daThanhToan += tienTra;
          hd.conLai = Math.max(0, hd.giaTriThanhToan - hd.daThanhToan);

          if (hd.conLai <= 0) hd.trangThai = "Đã thanh toán";
          else if (hd.daThanhToan > 0) hd.trangThai = "Thanh toán một phần";

          await hd.save({ session });

          newTotal += tienTra;
          danhSachLuuMoi.push({
            hoaDon: hd._id,
            soTienThanhToan: tienTra,
            giaTriHoaDon: snapshotGiaTri,
            daTTruocLanNay: snapshotDaTTruoc,
            conLaiTruocLanNay: snapshotConLaiTruoc,
          });
        }

        // BƯỚC C: CHỐT TỔNG PHIẾU THU
        phieuThu.danhSachHoaDon = danhSachLuuMoi;
        phieuThu.soTienThu = newTotal;
        phieuThu.duocKhauTru = newTotal; // Số tiền rót thực tế
        phieuThu.conThua = 0; // Kế toán gõ đích danh từng HĐ nên vĩnh viễn không có tiền thừa
      }

      await phieuThu.save({ session });
      updatedPhieu = phieuThu;
    });

    res.json({ success: true, data: updatedPhieu });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
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
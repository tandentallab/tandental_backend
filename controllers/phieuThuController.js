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

    // 🔥 LOGIC LẤY THÔNG TIN NHA KHOA ĐÃ ĐƯỢC TỐI ƯU SIÊU TỐC
    pipeline.push(
      // 1. Ưu tiên: Lookup trực tiếp từ trường nhaKhoa (Rất nhanh)
      { $lookup: { from: "nhakhoas", localField: "nhaKhoa", foreignField: "_id", as: "nhaKhoaDirect" } },

      // 2. Dự phòng: Cho các phiếu thu cũ chưa có trường nhaKhoa (Đi đường vòng qua HoaDon)
      { $addFields: { _hoaDonIds: "$danhSachHoaDon.hoaDon" } },
      { $lookup: { from: "hoadons", localField: "_hoaDonIds", foreignField: "_id", as: "hoaDonInfoList" } },
      { $addFields: { hoaDonInfo: { $arrayElemAt: ["$hoaDonInfoList", 0] } } },
      { $lookup: { from: "nhakhoas", localField: "hoaDonInfo.nhaKhoa", foreignField: "_id", as: "nhaKhoaFallback" } },

      // 3. Hợp nhất: Nếu có nhaKhoa trực tiếp thì xài, không thì xài dự phòng
      {
        $addFields: {
          nhaKhoaInfoArr: {
            $cond: {
              if: { $gt: [{ $size: "$nhaKhoaDirect" }, 0] },
              then: "$nhaKhoaDirect",
              else: "$nhaKhoaFallback"
            }
          }
        }
      },
      { $unwind: { path: "$nhaKhoaInfoArr", preserveNullAndEmptyArrays: true } },
      { $addFields: { nhaKhoaInfo: "$nhaKhoaInfoArr" } }, // Gán lại đúng tên biến để code bên dưới của bạn chạy

      // 4. Xóa rác cho nhẹ payload
      { $project: { nhaKhoaDirect: 0, nhaKhoaFallback: 0, nhaKhoaInfoArr: 0 } }
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

    // Enrich danhSachHoaDon with full hoaDon details
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

      // 🔥 BƯỚC 2: DUYỆT THEO MẢNG PHÂN BỔ THỰC TẾ
      for (const item of danhSachHoaDon) {
        const hdId = item.hoaDon;
        const tienTraChoHdNay = Number(item.soTienThanhToan || 0);

        if (tienTraChoHdNay <= 0) continue;

        const hd = await mongoose.model("HoaDon").findById(hdId).session(session);
        if (!hd) {
          throw new Error(`Không tìm thấy hóa đơn có ID: ${hdId}`);
        }

        const snapshotGiaTri = hd.giaTriThanhToan || 0;
        const snapshotDaTTruoc = hd.daThanhToan || 0;
        const snapshotConLaiTruoc = hd.conLai || 0;

        hd.daThanhToan += tienTraChoHdNay;
        hd.conLai = Math.max(0, hd.giaTriThanhToan - hd.daThanhToan);

        if (hd.conLai <= 0) hd.trangThai = "Đã thanh toán";
        else if (hd.daThanhToan > 0) hd.trangThai = "Thanh toán một phần";

        if (hd.congNoCuoiKy !== undefined) {
          hd.congNoCuoiKy = Math.max(0, (hd.congNoCuoiKy || 0) - tienTraChoHdNay);
        }

        await hd.save({ session });

        danhSachLuu.push({
          hoaDon: hd._id,
          soTienThanhToan: tienTraChoHdNay,
          giaTriHoaDon: snapshotGiaTri,
          daTTruocLanNay: snapshotDaTTruoc,
          conLaiTruocLanNay: snapshotConLaiTruoc,
        });
      }

      const tongKhauTruThucTe = danhSachLuu.reduce((sum, x) => sum + x.soTienThanhToan, 0);
      const conThua = Math.max(0, tongTienThuThucTe - tongKhauTruThucTe);

      // ================= TẠO MÃ PHIẾU THU TỰ ĐỘNG TĂNG =================
      const ngayThuDate = new Date(ngayThu || Date.now());
      const yy = String(ngayThuDate.getFullYear()).slice(-2);
      const mm = String(ngayThuDate.getMonth() + 1).padStart(2, "0");
      const prefix = `PT${yy}${mm}`; // Chữ PT thay cho TAN để phân biệt với hóa đơn

      // Tìm phiếu thu mới nhất trong tháng hiện tại
      const lastPhieuThu = await mongoose.model("PhieuThu").findOne(
        { soPhieuThu: new RegExp(`^${prefix}`) },
        { soPhieuThu: 1 }
      ).sort({ soPhieuThu: -1 }).session(session);

      let nextNumber = 1;
      if (lastPhieuThu && lastPhieuThu.soPhieuThu) {
        // Cắt lấy 4 số cuối cùng và cộng thêm 1
        const lastNumber = parseInt(lastPhieuThu.soPhieuThu.slice(-4), 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Ép thành chuỗi 4 chữ số (VD: 1 -> 0001, 15 -> 0015)
      const sttStr = nextNumber.toString().padStart(4, "0");
      const soPhieuThu = `${prefix}${sttStr}`;
      // =================================================================

      const newPhieuThu = new (mongoose.model("PhieuThu"))({
        soPhieuThu,
        nhaKhoa: nhaKhoaId, // ✅ ĐÃ FIX LỖI CHÍ MẠNG LÀM CHẾT BÁO CÁO DOANH THU
        danhSachHoaDon: danhSachLuu,
        nguoiTao: req.user?.id || req.user?._id || undefined,
        ngayThu: ngayThuDate,
        soTienThu: tongTienThuThucTe,
        duocKhauTru: tongKhauTruThucTe,
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

      // Lưu lại danh sách cũ TRƯỚC KHI sửa để dùng cho recalculate
      const oldDanhSachHoaDon = phieuThu.danhSachHoaDon.map(x => ({
        hoaDon: x.hoaDon.toString(),
        soTienThanhToan: x.soTienThanhToan,
      }));

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

          if (tienTra <= 0) continue;

          const hd = await HoaDon.findById(hdId).session(session);
          if (!hd) throw new Error(`Không tìm thấy hóa đơn: ${hdId}`);

          if (tienTra > hd.conLai) {
            throw new Error(`Hóa đơn ${hd.soHoaDon} chỉ còn nợ ${hd.conLai}, bạn không thể thanh toán ${tienTra}.`);
          }

          const snapshotGiaTri = hd.giaTriThanhToan || 0;
          const snapshotConLaiTruoc = hd.conLai || 0;

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
            daTTruocLanNay: 0,         // tạm, sẽ được ghi đúng ở Bước D
            conLaiTruocLanNay: snapshotConLaiTruoc,
          });
        }

        // BƯỚC C: CHỐT TỔNG PHIẾU THU
        phieuThu.danhSachHoaDon = danhSachLuuMoi;
        phieuThu.soTienThu = newTotal;
        phieuThu.duocKhauTru = newTotal;
        phieuThu.conThua = 0;
      }

      // Save phieuThu TRƯỚC — để ngayThu mới được ghi vào DB
      // Bước D mới sort đúng thứ tự được
      await phieuThu.save({ session });

      // BƯỚC D: RECALCULATE daTTruocLanNay THEO THỨ TỰ NGÀY MỚI
      const affectedHoaDonIds = [
        ...new Set([
          ...oldDanhSachHoaDon.map(x => x.hoaDon),
          ...(danhSachHoaDon || []).map(x => x.hoaDon.toString()),
        ])
      ];

      for (const hdId of affectedHoaDonIds) {
        const allPT = await PhieuThu.find({
          "danhSachHoaDon.hoaDon": hdId
        }).sort({ ngayThu: 1 }).session(session);

        let cumulative = 0;
        for (const pt of allPT) {
          const item = pt.danhSachHoaDon.find(
            x => x.hoaDon.toString() === hdId
          );
          if (!item) continue;

          item.daTTruocLanNay = cumulative;
          item.conLaiTruocLanNay = Math.max(0, item.giaTriHoaDon - cumulative);
          cumulative += item.soTienThanhToan;

          pt.markModified("danhSachHoaDon");
          await pt.save({ session });
        }
      }

      updatedPhieu = await PhieuThu.findById(phieuThu._id).session(session);
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
const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const BangGia = require("../models/BangGia");
const SanPham = require("../models/SanPham");
const logActivity = require("../utils/activityLogger");

const roundMoney = (n) => Math.round(Number(n || 0));

// tongCong - chietKhau = sauCK
// thue = sauCK × %
// giaTriThanhToan = sauCK + thue + chiPhiKhac
const calculateGiaTriThanhToan = ({ tongCong, chietKhau, thue, chiPhiKhac }) => {
  const sauChietKhau = Number(tongCong || 0) - Number(chietKhau || 0);
  const thueTien = sauChietKhau * (Number(thue || 0) / 100);
  return roundMoney(sauChietKhau + thueTien + Number(chiPhiKhac || 0));
};

const autoTrangThai = (hoaDon) => {
  if (hoaDon.conLai <= 0) return "Đã thanh toán";
  if (hoaDon.daThanhToan > 0) return "Thanh toán một phần";
  return "Chưa thanh toán";
};



// ================= BUILD DANH SACH SAN PHAM FLAT =================
// Nhận vào danh sách donHangIds + nhaKhoaId
// Trả về { danhSachSanPham (flat array), tongCong }
async function buildDanhSachSanPham(donHangIds, nhaKhoaId, session = null) {
  const danhSachSanPham = [];
  let tongCong = 0;

  for (const donHangId of donHangIds) {
    const query = DonHang.findById(donHangId);
    if (session) query.session(session);
    const donHang = await query;

    if (!donHang) throw new Error(`Không tìm thấy đơn hàng: ${donHangId}`);

    // Batch lấy tên sản phẩm
    const sanPhamIds = donHang.danhSachSanPham.map((sp) => sp.sanPham);
    const sanPhams = await SanPham.find({ _id: { $in: sanPhamIds } }).select("tenSanPham");
    const sanPhamMap = {};
    sanPhams.forEach((sp) => { sanPhamMap[sp._id.toString()] = sp; });

    for (const spItem of donHang.danhSachSanPham) {
      // 🔥 THAY ĐỔI TẠI ĐÂY: Lấy thẳng đơn giá cứng từ Đơn Hàng, không gọi hàm getDonGia động nữa!
      const donGia = Number(spItem.donGia || 0);

      const soLuong = Number(spItem.soLuong || 1);
      const thanhTien = donGia * soLuong;
      const giamGia = Math.max(0, Number(spItem.giamGia || 0));

      if (giamGia > thanhTien) {
        throw new Error("Giảm giá vượt quá thành tiền sản phẩm");
      }

      const tongCongSanPham = thanhTien - giamGia;
      tongCong += tongCongSanPham;

      danhSachSanPham.push({
        donHang: donHang._id,
        sanPhamDonHangId: spItem._id,
        sanPham: spItem.sanPham,
        tenSanPham: sanPhamMap[spItem.sanPham.toString()]?.tenSanPham || "",
        loaiDon: spItem.loaiDon || "Mới",
        viTri: spItem.viTri || [],
        soLuong,
        donGia: roundMoney(donGia),
        thanhTien: roundMoney(thanhTien),
        giamGia: roundMoney(giamGia),
        tongCongSanPham: roundMoney(tongCongSanPham),
        ghiChu: spItem.ghiChu || "",
      });
    }
  }

  return { danhSachSanPham, tongCong };
}

// ================= LẤY DANH SÁCH ĐƠN HÀNG CHƯA XUẤT HÓA ĐƠN =================
exports.getDonHangChuaXuatHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;

    // Khởi tạo query mặc định
    const query = {
      daXuatHoaDon: { $ne: true },
      "danhSachSanPham.loaiDon": "Mới",
    };

    // NẾU KHÁC "all", TỨC LÀ TÌM THEO ID NHA KHOA CỤ THỂ THÌ MỚI THÊM VÀO QUERY
    if (nhaKhoaId && nhaKhoaId !== "all") {
      query.nhaKhoa = nhaKhoaId;
    }

    const donHangs = await DonHang.find(query)
      .populate("bacSi", "hoVaTen")
      .populate("benhNhan", "hoVaTen")
      .populate("nhaKhoa", "hoVaTen tenNhaKhoa") // Bổ sung nha khoa để FE dùng nếu cần
      .sort({ createdAt: -1 });

    res.json(donHangs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ĐẾM SỐ ĐƠN HÀNG CHƯA XUẤT HÓA ĐƠN =================
exports.countDonHangChuaXuatHoaDonAll = async (req, res) => {
  try {
    const result = await DonHang.aggregate([
      {
        $match: {
          daXuatHoaDon: { $ne: true },
          "danhSachSanPham.loaiDon": "Mới",
        },
      },
      {
        $group: {
          _id: "$nhaKhoa",
          soDonHangChuaXuatHoaDon: { $sum: 1 },
          ngayDonHangGanNhat: { $max: "$ngayNhan" },
        },
      },
      {
        $lookup: {
          from: "nhakhoas",
          localField: "_id",
          foreignField: "_id",
          as: "nhaKhoa",
        },
      },
      { $unwind: "$nhaKhoa" },
      {
        $lookup: {
          from: "hoadons",
          let: { nhaKhoaId: "$nhaKhoa._id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$nhaKhoa", "$$nhaKhoaId"] } } },
            { $sort: { ngayXuatHoaDon: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, ngayXuatHoaDon: 1, giaTriThanhToan: 1, trangThai: 1 } },
          ],
          as: "hoaDonGanNhat",
        },
      },
      {
        $unwind: {
          path: "$hoaDonGanNhat",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          nhaKhoaId: "$nhaKhoa._id",
          tenNhaKhoa: "$nhaKhoa.tenNhaKhoa",
          hoVaTen: "$nhaKhoa.hoVaTen",
          tinh: "$nhaKhoa.tinh",
          soDonHangChuaXuatHoaDon: 1,
          ngayDonHangGanNhat: 1,
          ngayXuatHoaDonCuoi: "$hoaDonGanNhat.ngayXuatHoaDon",
          hoaDonGanNhat: "$hoaDonGanNhat",
        },
      },
      { $sort: { soDonHangChuaXuatHoaDon: -1 } },
    ]);

    res.json({ success: true, totalNhaKhoa: result.length, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= TẠO HÓA ĐƠN =================
exports.createHoaDon = async (req, res) => {
  try {
    const {
      nhaKhoaId,
      danhSachDonHangIds,
      chietKhau = 0,
      thue = 0,
      chiPhiKhac = 0,
      ghiChuNoiBo = "",
      ghiChuChoKhachHang = "",
      chinhSachThanhToan = "Thanh toán cuối tháng",
    } = req.body;

    if (!danhSachDonHangIds || danhSachDonHangIds.length === 0) {
      throw new Error("Danh sách đơn hàng trống");
    }
    if (Number(chietKhau) < 0) {
      throw new Error("Chiết khấu không hợp lệ");
    }

    // 1. Đánh dấu các đơn hàng này là đã xuất hóa đơn
    for (const donHangId of danhSachDonHangIds) {
      await DonHang.updateOne(
        { _id: donHangId, daXuatHoaDon: { $ne: true } },
        { $set: { daXuatHoaDon: true } }
      );
    }

    // 2. Build dữ liệu sản phẩm
    const { danhSachSanPham, tongCong } = await buildDanhSachSanPham(
      danhSachDonHangIds,
      nhaKhoaId
    );

    if (Number(chietKhau) > tongCong) {
      throw new Error("Chiết khấu vượt quá tổng cộng hóa đơn");
    }

    // 3. Tính toán tiền nong
    const giaTriThanhToan = calculateGiaTriThanhToan({ tongCong, chietKhau, thue, chiPhiKhac });

    // 4. TẠO MÃ HÓA ĐƠN ĐỘC NHẤT (Sửa lỗi Duplicate Key null)
    const newHoaDonId = new mongoose.Types.ObjectId();
    const maSoHoaDon = "TAN" + newHoaDonId.toString().slice(-8).toUpperCase();

    // 5. Lưu vào Database
    const hoaDon = await HoaDon.create(
      {
        _id: newHoaDonId, // Gán ID đã tạo ở trên
        soHoaDon: maSoHoaDon, // Gán mã hóa đơn
        nhaKhoa: nhaKhoaId,
        danhSachSanPham,
        tongCong: roundMoney(tongCong),
        chietKhau: roundMoney(chietKhau),
        thue: Number(thue || 0),
        chiPhiKhac: roundMoney(chiPhiKhac),
        giaTriThanhToan,
        daThanhToan: 0,
        conLai: giaTriThanhToan,
        trangThai: "Chưa thanh toán",
        ghiChuNoiBo,
        ghiChuChoKhachHang,
        chinhSachThanhToan,
      }
    );

        // ✅ LOG ACTIVITY ĐẶT TẠI ĐÂY
    await logActivity({
      req,

      action: "CREATE",

      module: "HOA_DON",

      targetId: hoaDon._id,

      targetName: hoaDon.soHoaDon,

      description: `Tạo hóa đơn ${hoaDon.soHoaDon}`,

      newData: {
        soHoaDon: hoaDon.soHoaDon,
        tongCong: hoaDon.tongCong,
        giaTriThanhToan: hoaDon.giaTriThanhToan,
        trangThai: hoaDon.trangThai,
      },
    });


    res.json({ success: true, data: hoaDon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= LẤY TẤT CẢ HÓA ĐƠN (ADMIN) =================
exports.getAllHoaDonAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { trangThai, search, nhaKhoaId, fromDate, toDate } = req.query;

    let query = {};

    if (trangThai) query.trangThai = trangThai;

    if (nhaKhoaId && mongoose.Types.ObjectId.isValid(nhaKhoaId)) {
      query.nhaKhoa = nhaKhoaId;
    }

    if (fromDate || toDate) {
      query.ngayXuatHoaDon = {};
      if (fromDate) query.ngayXuatHoaDon.$gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.ngayXuatHoaDon.$lte = endDate;
      }
    }

    if (search && search.trim() !== "") {
      const keyword = search.trim();
      query.$or = [
        { soHoaDon: { $regex: keyword, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  "TAN",
                  { $toUpper: { $substrCP: [{ $toString: "$_id" }, 16, 8] } },
                ],
              },
              regex: keyword.toUpperCase(),
              options: "i",
            },
          },
        },
      ];
    }

    const total = await HoaDon.countDocuments(query);
    const danhSach = await HoaDon.find(query)
      .populate("nhaKhoa", "hoVaTen tinh")
      .populate("danhSachSanPham.donHang", "maDonHang ngayNhan bacSi benhNhan")
      .populate("danhSachSanPham.sanPham", "tenSanPham maSanPham")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      results: danhSach.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: danhSach,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= LẤY HÓA ĐƠN THEO NHA KHOA =================
exports.getAllHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;
    const { search, trangThai } = req.query;

    let query = { nhaKhoa: nhaKhoaId };

    if (trangThai) query.trangThai = trangThai;

    if (search && search.match(/^[0-9a-fA-F]{24}$/)) {
      query.$or = [{ _id: search }];
    }

    const danhSach = await HoaDon.find(query)
      .populate("nhaKhoa", "tenNhaKhoa")
      .populate("danhSachSanPham.donHang", "maDonHang ngayNhan bacSi benhNhan")
      .populate("danhSachSanPham.sanPham", "tenSanPham maSanPham")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: danhSach.length, data: danhSach });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= LẤY CHI TIẾT HÓA ĐƠN =================
exports.getHoaDonById = async (req, res) => {
  try {
    const { id } = req.params;
    const hoaDon = await HoaDon.findById(id)
      .populate("nhaKhoa", "tenNhaKhoa hoVaTen soDienThoai email diaChi tinh")
      .populate({
        path: "danhSachSanPham.donHang",
        select: "maDonHang ngayNhan bacSi benhNhan",
        populate: [
          { path: "bacSi", select: "hoVaTen" },
          { path: "benhNhan", select: "hoVaTen soDienThoai email" },
        ],
      })
      .populate("danhSachSanPham.sanPham", "tenSanPham maSanPham");

    if (!hoaDon) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    res.json({ success: true, data: hoaDon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= CẬP NHẬT HÓA ĐƠN =================
exports.updateHoaDon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      danhSachDonHangIds, // mảng donHangId mới từ FE (nếu có thay đổi)
      chietKhau,
      thue,
      chiPhiKhac,
      ghiChuNoiBo,
      ghiChuChoKhachHang,
      chinhSachThanhToan,
    } = req.body;

    const hoaDon = await HoaDon.findById(id);
    if (!hoaDon) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    // Cập nhật các field đơn giản
    if (thue !== undefined) hoaDon.thue = Number(thue);
    if (chiPhiKhac !== undefined) hoaDon.chiPhiKhac = Number(chiPhiKhac);
    if (chietKhau !== undefined) hoaDon.chietKhau = Number(chietKhau);
    if (ghiChuNoiBo !== undefined) hoaDon.ghiChuNoiBo = ghiChuNoiBo;
    if (ghiChuChoKhachHang !== undefined) hoaDon.ghiChuChoKhachHang = ghiChuChoKhachHang;
    if (chinhSachThanhToan !== undefined) hoaDon.chinhSachThanhToan = chinhSachThanhToan;

    // Nếu FE gửi lại danh sách đơn hàng mới → rebuild
    if (danhSachDonHangIds) {
      const oldDonHangIds = [...new Set(hoaDon.danhSachSanPham.map((sp) => sp.donHang.toString()))];
      const newDonHangIds = danhSachDonHangIds.map((id) => id.toString());

      const removedIds = oldDonHangIds.filter((id) => !newDonHangIds.includes(id));
      if (removedIds.length > 0) {
        await DonHang.updateMany({ _id: { $in: removedIds } }, { $set: { daXuatHoaDon: false } });
      }
      await DonHang.updateMany({ _id: { $in: newDonHangIds } }, { $set: { daXuatHoaDon: true } });

      const { danhSachSanPham, tongCong } = await buildDanhSachSanPham(
        newDonHangIds,
        hoaDon.nhaKhoa
      );

      hoaDon.danhSachSanPham = danhSachSanPham;
      hoaDon.tongCong = roundMoney(tongCong);
    }

    hoaDon.giaTriThanhToan = calculateGiaTriThanhToan({
      tongCong: hoaDon.tongCong,
      chietKhau: hoaDon.chietKhau,
      thue: hoaDon.thue,
      chiPhiKhac: hoaDon.chiPhiKhac,
    });

    hoaDon.conLai = Math.max(0, roundMoney(hoaDon.giaTriThanhToan - hoaDon.daThanhToan));
    hoaDon.trangThai = autoTrangThai(hoaDon);

    const updated = await hoaDon.save();
    res.json({ success: true, message: "Cập nhật hóa đơn thành công", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= THANH TOÁN HÓA ĐƠN =================
exports.thanhToanHoaDon = async (req, res) => {
  try {
    const { id } = req.params;
    const { soTienThanhToan } = req.body;

    if (!soTienThanhToan || soTienThanhToan <= 0) {
      return res.status(400).json({ success: false, message: "Số tiền thanh toán không hợp lệ" });
    }

    const hoaDon = await HoaDon.findById(id);
    if (!hoaDon) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    if (soTienThanhToan > hoaDon.conLai) {
      return res.status(400).json({ success: false, message: "Số tiền vượt quá số tiền còn lại" });
    }

    hoaDon.daThanhToan += Number(soTienThanhToan);
    hoaDon.conLai = Math.max(0, roundMoney(hoaDon.giaTriThanhToan - hoaDon.daThanhToan));
    hoaDon.trangThai = autoTrangThai(hoaDon);

    await hoaDon.save();
    res.json({ success: true, message: "Thanh toán thành công", data: hoaDon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= XÓA HÓA ĐƠN =================
exports.deleteHoaDon = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;

      const hoaDon = await HoaDon.findById(id).session(session);
      if (!hoaDon) throw new Error("Không tìm thấy hóa đơn");

      if (hoaDon.trangThai === "Thanh toán một phần") {
        throw new Error("Không thể xóa hóa đơn đã thanh toán một phần");
      }

      // Rollback danh sách đơn hàng (lấy distinct)
      const donHangIds = [...new Set(hoaDon.danhSachSanPham.map((sp) => sp.donHang.toString()))];
      await DonHang.updateMany(
        { _id: { $in: donHangIds } },
        { $set: { daXuatHoaDon: false } },
        { session }
      );

      await HoaDon.findByIdAndDelete(id, { session });

      res.json({ success: true, message: "Xóa hóa đơn thành công" });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// ================= LẤY HÓA ĐƠN CHƯA THANH TOÁN THEO NHA KHOA =================
exports.getHoaDonChuaThanhToanByNhaKhoa = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;
    const danhSach = await HoaDon.find({
      nhaKhoa: nhaKhoaId,
      trangThai: { $in: ["Chưa thanh toán", "Thanh toán một phần"] },
    })
      .select("_id soHoaDon ngayXuatHoaDon giaTriThanhToan daThanhToan conLai trangThai")
      .sort({ ngayXuatHoaDon: -1 });

    res.json({ success: true, data: danhSach });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= THỐNG KÊ CÔNG NỢ =================
exports.thongKeCongNoHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.query;

    let query = {
      trangThai: { $in: ["Chưa thanh toán", "Thanh toán một phần"] },
    };

    if (nhaKhoaId && mongoose.Types.ObjectId.isValid(nhaKhoaId)) {
      query.nhaKhoa = nhaKhoaId;
    }

    const hoaDons = await HoaDon.find(query);
    const now = new Date();

    const getNgayDenHan = (ngayXuatHoaDon, chinhSachThanhToan) => {
      const dueDate = new Date(ngayXuatHoaDon);
      switch (chinhSachThanhToan) {
        case "Thanh toán trước":
        case "Thanh toán ngay":
          return dueDate;
        case "Thanh toán trong 7 ngày":
          dueDate.setDate(dueDate.getDate() + 7); return dueDate;
        case "Thanh toán trong 10 ngày":
          dueDate.setDate(dueDate.getDate() + 10); return dueDate;
        case "Thanh toán trong 30 ngày":
          dueDate.setDate(dueDate.getDate() + 30); return dueDate;
        case "Thanh toán trong 60 ngày":
          dueDate.setDate(dueDate.getDate() + 60); return dueDate;
        case "Thanh toán trong 90 ngày":
          dueDate.setDate(dueDate.getDate() + 90); return dueDate;
        case "Thanh toán cuối tháng":
          dueDate.setMonth(dueDate.getMonth() + 1);
          dueDate.setDate(0);
          dueDate.setHours(23, 59, 59, 999);
          return dueDate;
        default:
          return dueDate;
      }
    };

    let conNo = { soHoaDon: 0, tongTien: 0 };
    let treHan = { soHoaDon: 0, tongTien: 0 };
    let chuaDenHan = { soHoaDon: 0, tongTien: 0 };

    for (const hd of hoaDons) {
      const soTienConLai = Number(hd.conLai || 0);
      conNo.soHoaDon += 1;
      conNo.tongTien += soTienConLai;

      const ngayDenHan = getNgayDenHan(hd.ngayXuatHoaDon, hd.chinhSachThanhToan);
      if (now > ngayDenHan) {
        treHan.soHoaDon += 1;
        treHan.tongTien += soTienConLai;
      } else {
        chuaDenHan.soHoaDon += 1;
        chuaDenHan.tongTien += soTienConLai;
      }
    }

    res.json({ success: true, data: { conNo, treHan, chuaDenHan } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
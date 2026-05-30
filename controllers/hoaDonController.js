const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const BangGia = require("../models/BangGia");
const SanPham = require("../models/SanPham");
const logActivity = require("../utils/activityLogger");
const { getCongNoNhaKhoa } = require("../utils/congNo");

// 🔥 CẤU HÌNH DAYJS XỬ LÝ MÚI GIỜ VIỆT NAM (UTC+7)
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const VN_TZ = "Asia/Ho_Chi_Minh"; // UTC+7

// ================= FINANCIAL HELPERS (CENTRALIZED) =================
const roundMoney = (n) => Math.round(Number(n || 0));

// SỬA LẠI: Chỉ tính tiền phát sinh trong kỳ, không cộng dồn nợ cũ
const calculateGiaTriThanhToan = ({ tongCong, chietKhau, thue, chiPhiKhac }) => {
  const sauChietKhau = Math.max(0, Number(tongCong || 0) - Number(chietKhau || 0));
  const thueTien = sauChietKhau * (Number(thue || 0) / 100);
  return roundMoney(sauChietKhau + thueTien + Number(chiPhiKhac || 0));
};

// Tính còn lại của riêng hóa đơn tháng này
const calculateConLai = (giaTriThanhToan, daThanhToan) => {
  return roundMoney(Number(giaTriThanhToan || 0) - Number(daThanhToan || 0));
};


const autoTrangThai = (conLai, daThanhToan) => {
  if (conLai <= 0) return "Đã thanh toán";
  if (daThanhToan > 0) return "Thanh toán một phần";
  return "Chưa thanh toán";
};

// ================= BUILD DANH SACH SAN PHAM FLAT =================
async function buildDanhSachSanPham(donHangIds, nhaKhoaId, session = null) {
  const findOptions = session ? { session } : {};

  // 1. Fetch TẤT CẢ donHang trong 1 query duy nhất
  const donHangs = await DonHang.find(
    { _id: { $in: donHangIds } },
    null,
    findOptions
  );

  if (donHangs.length !== donHangIds.length) {
    const foundIds = new Set(donHangs.map((d) => d._id.toString()));
    const missing = donHangIds.find((id) => !foundIds.has(id.toString()));
    throw new Error(`Không tìm thấy đơn hàng: ${missing}`);
  }

  // 2. Gom TẤT CẢ sanPhamIds từ mọi donHang (dedup)
  const allSanPhamIds = [
    ...new Set(
      donHangs.flatMap((dh) => dh.danhSachSanPham.map((sp) => sp.sanPham.toString()))
    ),
  ];

  // 3. Batch fetch SanPham + BangGia song song — chỉ 2 query tổng cộng
  const [sanPhams, bangGias] = await Promise.all([
    SanPham.find({ _id: { $in: allSanPhamIds } }, "tenSanPham donGiaChung", findOptions),
    BangGia.find({ nhaKhoaId, sanPhamId: { $in: allSanPhamIds } }, null, findOptions),
  ]);

  const sanPhamMap = Object.fromEntries(sanPhams.map((sp) => [sp._id.toString(), sp]));
  const bangGiaMap = Object.fromEntries(bangGias.map((bg) => [bg.sanPhamId.toString(), bg]));

  // 4. Build snapshot — iterate theo thứ tự donHangIds gốc
  const donHangById = Object.fromEntries(donHangs.map((dh) => [dh._id.toString(), dh]));
  const danhSachSanPham = [];
  let tongCong = 0;

  for (const donHangId of donHangIds) {
    const donHang = donHangById[donHangId.toString()];

    for (const spItem of donHang.danhSachSanPham) {
      if (spItem.loaiDon !== "Mới") continue;
      const sanPhamId = spItem.sanPham.toString();
      const sanPham = sanPhamMap[sanPhamId];

      if (!sanPham) {
        throw new Error(`Không tìm thấy sản phẩm: ${sanPhamId}`);
      }

      // Snapshot giá realtime tại thời điểm tạo hóa đơn
      const bangGia = bangGiaMap[sanPhamId];
      const donGiaSnapshot = bangGia
        ? Number(bangGia.donGia ?? bangGia.gia ?? 0)
        : Number(sanPham.donGiaChung || 0);

      const soLuong = Number(spItem.soLuong || 1);
      const thanhTienSnapshot = donGiaSnapshot * soLuong;
      const giamGia = Math.max(0, Number(spItem.giamGia || 0));

      if (giamGia > thanhTienSnapshot) {
        throw new Error("Giảm giá vượt quá thành tiền sản phẩm");
      }

      const tongCongSanPham = thanhTienSnapshot - giamGia;
      tongCong += tongCongSanPham;

      danhSachSanPham.push({
        donHang: donHang._id,
        sanPhamDonHangId: spItem._id,
        sanPham: spItem.sanPham,
        tenSanPham: sanPham.tenSanPham || "",
        loaiDon: spItem.loaiDon || "Mới",
        viTri: spItem.viTri || [],
        soLuong,
        donGia: roundMoney(donGiaSnapshot),
        thanhTien: roundMoney(thanhTienSnapshot),
        giamGia: roundMoney(giamGia),
        tongCongSanPham: roundMoney(tongCongSanPham),
        ghiChu: spItem.ghiChu || "",
      });
    }
  }

  return { danhSachSanPham, tongCong: roundMoney(tongCong) };
}

// ================= LẤY DANH SÁCH ĐƠN HÀNG CHƯA XUẤT HÓA ĐƠN =================
exports.getDonHangChuaXuatHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;
    const { tuNgay, denNgay } = req.query;

    const query = {
      daXuatHoaDon: { $ne: true },
      "danhSachSanPham.loaiDon": "Mới",
    };

    if (nhaKhoaId && nhaKhoaId !== "all") {
      query.nhaKhoa = nhaKhoaId;
    }

    // 🔥 LOGIC LỌC THEO NGÀY NHẬN
    if (tuNgay || denNgay) {
      query.ngayNhan = {};
      if (tuNgay) {
        // SỬA CHÍNH TẠI ĐÂY: dayjs(tuNgay).tz(...) thay vì dayjs.tz(tuNgay, ...)
        query.ngayNhan.$gte = dayjs(tuNgay).tz(VN_TZ).startOf('day').toDate();
      }
      if (denNgay) {
        // SỬA CHÍNH TẠI ĐÂY: dayjs(denNgay).tz(...)
        query.ngayNhan.$lte = dayjs(denNgay).tz(VN_TZ).endOf('day').toDate();
      }
    }

    const donHangs = await DonHang.find(query)
      .populate("bacSi", "hoVaTen")
      .populate("benhNhan", "hoVaTen")
      .populate("nhaKhoa", "hoVaTen tenNhaKhoa")
      .sort({ ngayNhan: 1 });

    // 🔥 DÙNG JAVASCRIPT ĐỂ LỌC SẠCH MẢNG SẢN PHẨM TRƯỚC KHI TRẢ VỀ
    const donHangsDaLoc = donHangs.map(don => {
      const donObj = don.toObject();

      if (donObj.danhSachSanPham) {
        // Chỉ giữ lại sản phẩm "Mới"
        donObj.danhSachSanPham = donObj.danhSachSanPham.filter(sp => sp.loaiDon === "Mới");
      }

      return donObj;
    });

    // Bước bảo vệ: Tránh trường hợp đơn hàng lọc xong không còn sản phẩm nào
    const donHangsCuoiCung = donHangsDaLoc.filter(don => don.danhSachSanPham && don.danhSachSanPham.length > 0);

    res.json(donHangsCuoiCung);
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
      // 🔥 Thêm block này để lọc sạch mảng sản phẩm ngay từ trong Database
      {
        $set: {
          danhSachSanPham: {
            $filter: {
              input: "$danhSachSanPham",
              as: "sp",
              cond: { $eq: ["$$sp.loaiDon", "Mới"] }
            }
          }
        }
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
            { $sort: { denNgay: -1 } }, // 🔥 Đã sửa thành denNgay chuẩn kế toán
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

// ================= LẤY NGÀY XUẤT HÓA ĐƠN GẦN NHẤT CỦA TẤT CẢ NHA KHOA =================
exports.getNgayXuatHoaDonGanNhatAll = async (req, res) => {
  try {
    const result = await HoaDon.aggregate([
      { $sort: { denNgay: -1 } },
      {
        $group: {
          _id: "$nhaKhoa",
          hoaDonId: { $first: "$_id" },
          soHoaDonGanNhat: { $first: "$soHoaDon" },
          ngayXuatHoaDonGanNhat: { $first: "$ngayXuatHoaDon" },
          giaTriThanhToan: { $first: "$giaTriThanhToan" },
          trangThai: { $first: "$trangThai" },
        },
      },
      {
        $lookup: {
          from: "nhakhoas",
          localField: "_id",
          foreignField: "_id",
          as: "nhaKhoaInfo",
        },
      },
      { $unwind: "$nhaKhoaInfo" },
      {
        $project: {
          _id: 0,
          nhaKhoaId: "$_id",
          tenNhaKhoa: "$nhaKhoaInfo.tenNhaKhoa",
          hoVaTen: "$nhaKhoaInfo.hoVaTen",
          tinh: "$nhaKhoaInfo.tinh",
          hoaDonGanNhat: {
            _id: "$hoaDonId",
            soHoaDon: "$soHoaDonGanNhat",
            ngayXuatHoaDon: "$ngayXuatHoaDonGanNhat",
            giaTriThanhToan: "$giaTriThanhToan",
            trangThai: "$trangThai"
          }
        },
      },
      { $sort: { "hoaDonGanNhat.ngayXuatHoaDon": -1 } }
    ]);

    res.json({
      success: true,
      total: result.length,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.createHoaDon = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let hoaDon;

    await session.withTransaction(async () => {
      const {
        nhaKhoaId,
        danhSachDonHangIds,
        tuNgay,
        denNgay,
        chietKhau = 0,
        thue = 0,
        chiPhiKhac = 0,
        ghiChuNoiBo = "",
        ghiChuChoKhachHang = "",
        chinhSachThanhToan = "Thanh toán cuối tháng",
      } = req.body;

      if (!nhaKhoaId) throw new Error("Thiếu nhaKhoaId");
      if (!danhSachDonHangIds?.length) throw new Error("Danh sách đơn hàng trống");
      if (!tuNgay || !denNgay) throw new Error("Vui lòng chọn khoảng thời gian chốt hóa đơn (tuNgay, denNgay)");
      if (Number(chietKhau) < 0) throw new Error("Chiết khấu không hợp lệ");

      // 🔥 LẤY ĐÚNG NGÀY KẾ TOÁN CHỌN - KHÔNG RÀNG BUỘC
      // Ép chuẩn giờ VN để không bị lệch múi giờ
      const finalTuNgay = dayjs(tuNgay).tz(VN_TZ).startOf('day').toDate();
      const finalDenNgay = dayjs(denNgay).tz(VN_TZ).endOf('day').toDate();

      if (finalTuNgay > finalDenNgay) {
        throw new Error("Ngày bắt đầu không thể lớn hơn ngày kết thúc.");
      }

      const newHoaDonId = new mongoose.Types.ObjectId();
      const maSoHoaDon = "TAN" + newHoaDonId.toString().slice(-8).toUpperCase();

      const updateResult = await DonHang.updateMany(
        { _id: { $in: danhSachDonHangIds }, daXuatHoaDon: { $ne: true } },
        { $set: { daXuatHoaDon: true, hoaDonThang: newHoaDonId } },
        { session }
      );

      if (updateResult.modifiedCount !== danhSachDonHangIds.length) {
        throw new Error("Một số đơn hàng đã được xuất hóa đơn trước đó");
      }

      const { danhSachSanPham, tongCong } = await buildDanhSachSanPham(
        danhSachDonHangIds,
        nhaKhoaId,
        session
      );

      if (Number(chietKhau) > tongCong) {
        throw new Error("Chiết khấu vượt quá tổng cộng hóa đơn");
      }

      const nhaKhoaInfo = await mongoose.model("NhaKhoa").findById(nhaKhoaId).session(session);
      if (!nhaKhoaInfo) throw new Error("Không tìm thấy Nha Khoa");
      // Chỉ tính thuần túy phát sinh của kỳ này
      const phatSinhKyNay = calculateGiaTriThanhToan({ tongCong, chietKhau, thue, chiPhiKhac });

      // Giá trị thanh toán bây giờ chỉ bằng đúng phát sinh kỳ này (Không cộng nợ cũ nữa)
      const giaTriThanhToan = phatSinhKyNay;
      const conLai = giaTriThanhToan;

      const newHoaDon = new HoaDon({
        _id: newHoaDonId,
        soHoaDon: maSoHoaDon,
        nhaKhoa: nhaKhoaId,
        tuNgay: finalTuNgay,
        denNgay: finalDenNgay,
        danhSachSanPham,
        tongCong: roundMoney(tongCong),
        chietKhau: roundMoney(chietKhau),
        thue: Number(thue || 0),
        chiPhiKhac: roundMoney(chiPhiKhac),
        giaTriThanhToan,
        daThanhToan: 0,
        conLai,
        // 🔥 ĐÃ XÓA noDauKy VÀ soDuMigrate KHỎI PAYLOAD LƯU DB
        trangThai: autoTrangThai(conLai, 0),
        ghiChuNoiBo,
        ghiChuChoKhachHang,
        chinhSachThanhToan,
      });

      await newHoaDon.save({ session });
      hoaDon = newHoaDon;
    });

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
  } finally {
    session.endSession();
  }
};

const buildTrangThaiQuery = (trangThai) => {
  if (!trangThai) return undefined;
  const list = trangThai.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return undefined;
  return { $in: list };
};

// ================= LẤY TẤT CẢ HÓA ĐƠN (ADMIN) =================
exports.getAllHoaDonAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { trangThai, search, nhaKhoaId, fromDate, toDate } = req.query;

    let query = {
      soHoaDon: { $not: /^SDDK/i }
    };
    const trangThaiQuery = buildTrangThaiQuery(trangThai);
    if (trangThaiQuery) query.trangThai = trangThaiQuery;
    if (nhaKhoaId && mongoose.Types.ObjectId.isValid(nhaKhoaId)) query.nhaKhoa = nhaKhoaId;

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
                $concat: ["TAN", { $toUpper: { $substrCP: [{ $toString: "$_id" }, 16, 8] } }],
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
    const trangThaiQuery = buildTrangThaiQuery(trangThai);
    if (trangThaiQuery) query.trangThai = trangThaiQuery;

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
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    const congNoNhaKhoa = await getCongNoNhaKhoa(
      hoaDon.nhaKhoa._id
    );
    // 🔥 LOGIC CHUẨN NGHIỆP VỤ: Tính Nợ đầu kỳ động dựa trên NGÀY XUẤT HÓA ĐƠN
    const cacHoaDonTruoc = await HoaDon.find({
      nhaKhoa: hoaDon.nhaKhoa._id,
      _id: { $ne: hoaDon._id }, // Trừ chính hóa đơn đang xem ra
      trangThai: { $ne: "Đã thanh toán" }, // Chỉ lấy các hóa đơn còn nợ
      $or: [
        // Điều kiện 1: Ưu tiên tuyệt đối lấy các hóa đơn có Ngày Xuất cũ hơn
        { ngayXuatHoaDon: { $lt: hoaDon.ngayXuatHoaDon } },

        // Điều kiện 2: Xử lý ngoại lệ nếu có 2 hóa đơn CÙNG CHUNG 1 NGÀY XUẤT
        // -> Hóa đơn nào được nhập vào phần mềm trước (createdAt) thì được tính là nợ cũ
        {
          ngayXuatHoaDon: hoaDon.ngayXuatHoaDon,
          createdAt: { $lt: hoaDon.createdAt }
        }
      ]
    });

    // Cộng dồn tiền còn nợ của các hóa đơn cũ
    const noDauKyDong = cacHoaDonTruoc.reduce((tong, hd) => tong + (hd.conLai || 0), 0);

    res.json({
      success: true,
      data: {
        ...hoaDon.toObject(),
        congNoNhaKhoa,
        noDauKy: noDauKyDong, // Con số này giờ đây đã chuẩn 100% theo ngày xuất
        tongCanThanhToan: hoaDon.giaTriThanhToan + noDauKyDong
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateHoaDon = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedHoaDon;

    await session.withTransaction(async () => {
      const { id } = req.params;
      const {
        danhSachDonHangIds,
        danhSachSanPham: danhSachSanPhamMoi,
        chietKhau,
        thue,
        chiPhiKhac,
        ghiChuNoiBo,
        ghiChuChoKhachHang,
        chinhSachThanhToan,
        ngayXuatHoaDon,
      } = req.body;

      const hoaDon = await HoaDon.findById(id).session(session);
      if (!hoaDon) {
        throw new Error("Không tìm thấy hóa đơn");
      }

      // ================= 1. CÁC TRƯỜNG LUÔN CHO PHÉP SỬA (PHI TÀI CHÍNH) =================
      if (ghiChuNoiBo !== undefined) hoaDon.ghiChuNoiBo = ghiChuNoiBo;
      if (ghiChuChoKhachHang !== undefined) hoaDon.ghiChuChoKhachHang = ghiChuChoKhachHang;
      if (chinhSachThanhToan !== undefined) hoaDon.chinhSachThanhToan = chinhSachThanhToan;
      if (ngayXuatHoaDon) hoaDon.ngayXuatHoaDon = new Date(ngayXuatHoaDon);

      // ================= 2. KIỂM TRA ĐIỀU KIỆN KHÓA TÀI CHÍNH =================
      const isPaid = hoaDon.daThanhToan > 0;

      // CHỈ chặn duy nhất trường hợp hóa đơn đã có Phiếu thu (isPaid = true)
      const allowFinancialUpdate = !isPaid;

      // 🔥 LOGIC THÔNG MINH: Chỉ chặn khi các con số THỰC SỰ bị lệch so với Database
      let isTryingToChangeMoney = false;

      // 1. Check tiền ở tổng hóa đơn
      if (chietKhau !== undefined && Number(chietKhau) !== hoaDon.chietKhau) isTryingToChangeMoney = true;
      if (thue !== undefined && Number(thue) !== hoaDon.thue) isTryingToChangeMoney = true;
      if (chiPhiKhac !== undefined && Number(chiPhiKhac) !== hoaDon.chiPhiKhac) isTryingToChangeMoney = true;
      if (danhSachDonHangIds) isTryingToChangeMoney = true; // Thêm bớt đơn hàng là chắc chắn đổi tiền

      // 2. Check sâu vào từng sản phẩm (Đơn giá/Thành tiền là snapshot, KHÔNG CHECK)
      if (danhSachSanPhamMoi?.length) {
        for (const spMoi of danhSachSanPhamMoi) {
          const spCu = hoaDon.danhSachSanPham.find((s) =>
            spMoi.sanPhamDonHangId
              ? s.sanPhamDonHangId?.toString() === spMoi.sanPhamDonHangId.toString()
              : s.donHang?.toString() === spMoi.donHang?.toString() &&
              s.sanPham?.toString() === spMoi.sanPham?.toString()
          );

          if (spCu) {
            // CHỈ check sửa Giảm giá và Loại giảm giá
            if (spMoi.giamGia !== undefined && Number(spMoi.giamGia) !== (spCu.giamGia || 0)) {
              isTryingToChangeMoney = true; break;
            }
            if (spMoi.loaiGiamGia !== undefined && spMoi.loaiGiamGia !== spCu.loaiGiamGia) {
              isTryingToChangeMoney = true; break;
            }
          }
        }
      }

      // Xong xuôi mới đem đi phán xét
      if (!allowFinancialUpdate && isTryingToChangeMoney) {
        throw new Error("Hóa đơn này đã được thanh toán, tuyệt đối không thể thay đổi số tiền hay giảm giá sản phẩm!");
      }

      // ================= CẬP NHẬT TÀI CHÍNH (NẾU ĐƯỢC PHÉP) =================
      if (allowFinancialUpdate) {
        if (chietKhau !== undefined && Number(chietKhau) < 0) throw new Error("Chiết khấu không hợp lệ");
        if (thue !== undefined && Number(thue) < 0) throw new Error("Thuế không hợp lệ");
        if (chiPhiKhac !== undefined && Number(chiPhiKhac) < 0) throw new Error("Chi phí khác không hợp lệ");

        if (thue !== undefined) hoaDon.thue = Number(thue);
        if (chiPhiKhac !== undefined) hoaDon.chiPhiKhac = Number(chiPhiKhac);
        if (chietKhau !== undefined) hoaDon.chietKhau = Number(chietKhau);

        // Cập nhật danh sách đơn hàng gộp vào hóa đơn nếu có thay đổi
        if (danhSachDonHangIds) {
          const oldDonHangIds = [...new Set(hoaDon.danhSachSanPham.map((sp) => sp.donHang.toString()))];
          const newDonHangIds = danhSachDonHangIds.map((id) => id.toString());

          const removedIds = oldDonHangIds.filter((id) => !newDonHangIds.includes(id));
          if (removedIds.length > 0) {
            await DonHang.updateMany({ _id: { $in: removedIds } }, { $set: { daXuatHoaDon: false, hoaDonThang: null } }, { session });
          }
          await DonHang.updateMany({ _id: { $in: newDonHangIds } }, { $set: { daXuatHoaDon: true, hoaDonThang: hoaDon._id } }, { session });

          const { danhSachSanPham, tongCong } = await buildDanhSachSanPham(newDonHangIds, hoaDon.nhaKhoa, session);
          hoaDon.danhSachSanPham = danhSachSanPham;
          hoaDon.tongCong = roundMoney(tongCong);
        }
        // Cập nhật giảm giá/ghi chú cho từng sản phẩm
        else if (danhSachSanPhamMoi?.length) {
          danhSachSanPhamMoi.forEach((spMoi) => {
            const sp = hoaDon.danhSachSanPham.find((s) =>
              spMoi.sanPhamDonHangId
                ? s.sanPhamDonHangId?.toString() === spMoi.sanPhamDonHangId.toString()
                : s.donHang?.toString() === spMoi.donHang?.toString() &&
                s.sanPham?.toString() === spMoi.sanPham?.toString()
            );

            if (!sp) return;

            // ✅ CHỈ CẬP NHẬT GIẢM GIÁ (Tuyệt đối không gán đè Đơn giá)
            if (spMoi.giamGia !== undefined) {
              const giamGiaTien = Math.max(0, Number(spMoi.giamGia));
              // So sánh với thanhTien snapshot bất di bất dịch
              if (giamGiaTien > sp.thanhTien) {
                throw new Error(`Giảm giá vượt quá thành tiền của sản phẩm: ${sp.tenSanPham || 'Sản phẩm'}`);
              }
              sp.giamGia = roundMoney(giamGiaTien);
            }

            if (spMoi.loaiGiamGia !== undefined) sp.loaiGiamGia = spMoi.loaiGiamGia;
            if (spMoi.ghiChu !== undefined) sp.ghiChu = spMoi.ghiChu;

            // Tính lại tổng cộng sản phẩm dựa trên thanhTien snapshot
            sp.tongCongSanPham = roundMoney(sp.thanhTien - (sp.giamGia || 0));
          });

          hoaDon.tongCong = roundMoney(
            hoaDon.danhSachSanPham.reduce((s, sp) => s + (sp.tongCongSanPham || 0), 0)
          );
        }

        if (hoaDon.chietKhau > hoaDon.tongCong) throw new Error("Chiết khấu vượt quá tổng cộng hóa đơn");
        if (hoaDon.tongCong < 0) throw new Error("Tổng cộng hóa đơn không được âm");

        // Tính toán lại dòng tiền phát sinh kỳ này
        const phatSinhKyNay = calculateGiaTriThanhToan({
          tongCong: hoaDon.tongCong,
          chietKhau: hoaDon.chietKhau,
          thue: hoaDon.thue,
          chiPhiKhac: hoaDon.chiPhiKhac,
        });

        hoaDon.giaTriThanhToan = phatSinhKyNay;

        if (hoaDon.giaTriThanhToan < 0) throw new Error("Giá trị thanh toán cuối cùng không được âm");

        hoaDon.conLai = calculateConLai(hoaDon.giaTriThanhToan, hoaDon.daThanhToan);
        hoaDon.trangThai = autoTrangThai(hoaDon.conLai, hoaDon.daThanhToan);
      }

      // Lưu lại hóa đơn (Nếu allowFinancialUpdate = false, nó chỉ cập nhật các trường ghi chú ở mục 1)
      await hoaDon.save({ session });
      updatedHoaDon = hoaDon;
    });

    // Lấy lại hóa đơn đã được Populate đầy đủ y hệt như hàm getHoaDonById
    const finalHoaDon = await HoaDon.findById(updatedHoaDon._id)
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

    // Tính toán kéo luôn công nợ mới nhất của Nha khoa
    const congNoNhaKhoa = await getCongNoNhaKhoa(finalHoaDon.nhaKhoa._id);

    // Trả về dữ liệu xịn sò, đầy đủ nhất cho Frontend
    res.json({
      success: true,
      message: "Cập nhật hóa đơn thành công",
      data: {
        ...finalHoaDon.toObject(),
        congNoNhaKhoa
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};


// ================= THANH TOÁN HÓA ĐƠN =================
exports.thanhToanHoaDon = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedHoaDon;

    await session.withTransaction(async () => {
      const { id } = req.params;
      const { soTienThanhToan } = req.body;
      const tienThanhToan = Number(soTienThanhToan);

      if (isNaN(tienThanhToan) || tienThanhToan <= 0) {
        throw new Error("Số tiền thanh toán không hợp lệ");
      }

      const hoaDon = await HoaDon.findById(id).session(session);
      if (!hoaDon) {
        throw new Error("Không tìm thấy hóa đơn");
      }

      if (tienThanhToan > hoaDon.conLai && hoaDon.conLai > 0) {
        throw new Error(`Số tiền thanh toán (${tienThanhToan}) vượt quá số tiền còn lại của hóa đơn này (${hoaDon.conLai})`);
      }

      hoaDon.daThanhToan = roundMoney(hoaDon.daThanhToan + tienThanhToan);
      hoaDon.conLai = calculateConLai(hoaDon.giaTriThanhToan, hoaDon.daThanhToan);
      hoaDon.trangThai = autoTrangThai(hoaDon.conLai, hoaDon.daThanhToan);
      await hoaDon.save({ session });
      updatedHoaDon = hoaDon;
    });

    res.json({ success: true, message: "Thanh toán thành công", data: updatedHoaDon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// ================= XÓA HÓA ĐƠN =================
exports.deleteHoaDon = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let successMessage = "";

    await session.withTransaction(async () => {
      const { id } = req.params;

      const hoaDon = await HoaDon.findById(id).session(session);
      if (!hoaDon) throw new Error("Không tìm thấy hóa đơn");

      if (hoaDon.daThanhToan > 0) {
        throw new Error("Không thể xóa hóa đơn đã có giao dịch thanh toán");
      }

      const donHangIds = [...new Set(hoaDon.danhSachSanPham.map((sp) => sp.donHang.toString()))];
      await DonHang.updateMany(
        { _id: { $in: donHangIds } },
        { $set: { daXuatHoaDon: false, hoaDonThang: null } },
        { session }
      );

      await HoaDon.findByIdAndDelete(id, { session });
      successMessage = "Xóa hóa đơn và rollback trạng thái thành công";
    });

    res.json({ success: true, message: successMessage });

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

    // 🔥 Cập nhật query: Thêm soTienMigrate vào select để Frontend hiển thị thông báo gộp
    const danhSach = await HoaDon.find({
      nhaKhoa: nhaKhoaId,
      trangThai: { $in: ["Chưa thanh toán", "Thanh toán một phần"] },
    })
      .select("_id soHoaDon ngayXuatHoaDon giaTriThanhToan daThanhToan conLai  trangThai")
      .sort({ ngayXuatHoaDon: 1, createdAt: 1 }); // 🔥 Sắp xếp cũ nhất lên đầu để dội thác nước đúng thứ tự

    res.json({ success: true, data: danhSach });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.thongKeCongNoHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.query;

    // 🔥 ĐÃ SỬA: Thêm điều kiện loại bỏ tất cả các hóa đơn bắt đầu bằng chữ SDDK
    let query = {
      trangThai: { $in: ["Chưa thanh toán", "Thanh toán một phần"] },
      soHoaDon: { $not: /^SDDK/i }
    };

    if (nhaKhoaId && mongoose.Types.ObjectId.isValid(nhaKhoaId)) {
      query.nhaKhoa = nhaKhoaId;
    }

    const hoaDons = await HoaDon.find(query);

    const now = dayjs().tz(VN_TZ).valueOf();

    const getNgayDenHan = (ngayXuatHoaDon, chinhSachThanhToan) => {
      const baseDate = dayjs(ngayXuatHoaDon).tz(VN_TZ);

      switch (chinhSachThanhToan) {
        case "Thanh toán trước":
        case "Thanh toán ngay":
          return baseDate.endOf('day').valueOf();
        case "Thanh toán trong 7 ngày":
          return baseDate.add(7, 'day').endOf('day').valueOf();
        case "Thanh toán trong 10 ngày":
          return baseDate.add(10, 'day').endOf('day').valueOf();
        case "Thanh toán trong 30 ngày":
          return baseDate.add(30, 'day').endOf('day').valueOf();
        case "Thanh toán trong 60 ngày":
          return baseDate.add(60, 'day').endOf('day').valueOf();
        case "Thanh toán trong 90 ngày":
          return baseDate.add(90, 'day').endOf('day').valueOf();
        case "Thanh toán cuối tháng":
          return baseDate.endOf('month').valueOf();
        default:
          return baseDate.endOf('day').valueOf();
      }
    };

    let conNo = { soHoaDon: 0, tongTien: 0 };
    let treHan = { soHoaDon: 0, tongTien: 0 };
    let chuaDenHan = { soHoaDon: 0, tongTien: 0 };

    for (const hd of hoaDons) {
      const soTienConLai = Number(hd.conLai || 0);
      conNo.soHoaDon += 1;
      conNo.tongTien += soTienConLai;

      const timestampDenHan = getNgayDenHan(hd.ngayXuatHoaDon, hd.chinhSachThanhToan);

      if (now > timestampDenHan) {
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
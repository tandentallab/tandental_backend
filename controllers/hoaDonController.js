const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const BangGia = require("../models/BangGia");
const SanPham = require("../models/SanPham");
const logActivity = require("../utils/activityLogger");

// ================= FINANCIAL HELPERS (CENTRALIZED) =================
const roundMoney = (n) => Math.round(Number(n || 0));

// Tính giá trị thanh toán cuối cùng
const calculateGiaTriThanhToan = ({ tongCong, chietKhau, thue, chiPhiKhac }) => {
  const sauChietKhau = Math.max(0, Number(tongCong || 0) - Number(chietKhau || 0));
  const thueTien = sauChietKhau * (Number(thue || 0) / 100);
  return roundMoney(sauChietKhau + thueTien + Number(chiPhiKhac || 0));
};

// Tính toán nợ còn lại an toàn (không bao giờ âm)
const calculateConLai = (giaTriThanhToan, daThanhToan) => {
  return Math.max(0, roundMoney(Number(giaTriThanhToan || 0) - Number(daThanhToan || 0)));
};

// Tự động nội suy trạng thái từ dòng tiền thay vì set cứng
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
        donGiaSnapshot: roundMoney(donGiaSnapshot),
        thanhTienSnapshot: roundMoney(thanhTienSnapshot),
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

// ================= LẤY NGÀY XUẤT HÓA ĐƠN GẦN NHẤT CỦA TẤT CẢ NHA KHOA =================
exports.getNgayXuatHoaDonGanNhatAll = async (req, res) => {
  try {
    const result = await HoaDon.aggregate([
      // 1. Sắp xếp toàn bộ hóa đơn theo ngày xuất mới nhất trước
      { $sort: { ngayXuatHoaDon: -1 } },

      // 2. Nhóm theo từng nha khoa và lấy hóa đơn đầu tiên (chính là hóa đơn mới nhất)
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

      // 3. Lookup sang bảng NhaKhoa để lấy thông tin chi tiết của nha khoa đó
      {
        $lookup: {
          from: "nhakhoas", // Tên collection của NhaKhoa trong compass/atlas (thường là viết thường + thêm "s")
          localField: "_id",
          foreignField: "_id",
          as: "nhaKhoaInfo",
        },
      },

      // 4. Trải phẳng mảng nhaKhoaInfo vừa lookup được
      { $unwind: "$nhaKhoaInfo" },

      // 5. Định dạng lại payload trả về cho đẹp và gọn gàng
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

      // 6. Sắp xếp danh sách nha khoa theo thứ tự ai vừa được xuất hóa đơn gần đây nhất lên đầu
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

// ================= TẠO HÓA ĐƠN =================
exports.createHoaDon = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let hoaDon;

    await session.withTransaction(async () => {
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

      if (!nhaKhoaId) throw new Error("Thiếu nhaKhoaId");
      if (!danhSachDonHangIds?.length) throw new Error("Danh sách đơn hàng trống");
      if (Number(chietKhau) < 0) throw new Error("Chiết khấu không hợp lệ");

      // 1. Đánh dấu đơn hàng trong 1 query, trong transaction
      const updateResult = await DonHang.updateMany(
        { _id: { $in: danhSachDonHangIds }, daXuatHoaDon: { $ne: true } },
        { $set: { daXuatHoaDon: true } },
        { session }
      );

      if (updateResult.modifiedCount !== danhSachDonHangIds.length) {
        throw new Error("Một số đơn hàng đã được xuất hóa đơn trước đó");
      }

      // 2. Build snapshot giá tại thời điểm tạo hóa đơn (trong transaction)
      const { danhSachSanPham, tongCong } = await buildDanhSachSanPham(
        danhSachDonHangIds,
        nhaKhoaId,
        session
      );

      if (Number(chietKhau) > tongCong) {
        throw new Error("Chiết khấu vượt quá tổng cộng hóa đơn");
      }

      // 3. Tính toán tiền
      const giaTriThanhToan = calculateGiaTriThanhToan({ tongCong, chietKhau, thue, chiPhiKhac });

      // 4. Tạo mã hóa đơn
      const newHoaDonId = new mongoose.Types.ObjectId();
      const maSoHoaDon = "TAN" + newHoaDonId.toString().slice(-8).toUpperCase();

      // 5. Lưu vào DB (trong transaction)
      const [created] = await HoaDon.create(
        [
          {
            _id: newHoaDonId,
            soHoaDon: maSoHoaDon,
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
          },
        ],
        { session }
      );

      hoaDon = created;
    });

    // Log ngoài transaction (non-critical, không rollback nếu log lỗi)
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

  const list = trangThai
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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

    let query = {};

    const trangThaiQuery = buildTrangThaiQuery(trangThai);

    if (trangThaiQuery) {
      query.trangThai = trangThaiQuery;
    }

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

    const trangThaiQuery = buildTrangThaiQuery(trangThai);

    if (trangThaiQuery) {
      query.trangThai = trangThaiQuery;
    }

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
    const congNoResult = await HoaDon.aggregate([
      {
        $match: {
          nhaKhoa: hoaDon.nhaKhoa?._id || hoaDon.nhaKhoa,
          conLai: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          tongCongNo: { $sum: "$conLai" },
        },
      },
    ]);

    const congNoNhaKhoa = congNoResult[0]?.tongCongNo || 0;

    res.json({
      success: true,
      data: {
        ...hoaDon.toObject(),
        congNoNhaKhoa,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= CẬP NHẬT HÓA ĐƠN =================
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
        ngayXuatHoaDon, // 🔥 BỔ SUNG TRƯỜNG NÀY
      } = req.body;

      const hoaDon = await HoaDon.findById(id).session(session);
      if (!hoaDon) {
        throw new Error("Không tìm thấy hóa đơn");
      }

      const isPaid = hoaDon.daThanhToan > 0;

      // 1. NGĂN CHẶN SỬA ĐỔI DỮ LIỆU TÀI CHÍNH/THỜI GIAN NẾU ĐÃ CÓ THANH TOÁN
      let isFinancialUpdate = false;
      if (danhSachDonHangIds) isFinancialUpdate = true;
      if (danhSachSanPhamMoi && danhSachSanPhamMoi.length > 0) isFinancialUpdate = true;
      if (chietKhau !== undefined && Number(chietKhau) !== hoaDon.chietKhau) isFinancialUpdate = true;
      if (thue !== undefined && Number(thue) !== hoaDon.thue) isFinancialUpdate = true;
      if (chiPhiKhac !== undefined && Number(chiPhiKhac) !== hoaDon.chiPhiKhac) isFinancialUpdate = true;

      // Check nếu cố tình đổi ngày xuất hóa đơn
      if (ngayXuatHoaDon) {
        const oldDate = new Date(hoaDon.ngayXuatHoaDon).setHours(0, 0, 0, 0);
        const newDate = new Date(ngayXuatHoaDon).setHours(0, 0, 0, 0);
        if (oldDate !== newDate) isFinancialUpdate = true;
      }

      if (isPaid && isFinancialUpdate) {
        throw new Error("Hóa đơn đã có giao dịch thanh toán, chỉ được phép sửa ghi chú và chính sách thanh toán.");
      }

      // 2. LUÔN CHO PHÉP CẬP NHẬT CÁC TRƯỜNG TEXT/META
      if (ghiChuNoiBo !== undefined) hoaDon.ghiChuNoiBo = ghiChuNoiBo;
      if (ghiChuChoKhachHang !== undefined) hoaDon.ghiChuChoKhachHang = ghiChuChoKhachHang;
      if (chinhSachThanhToan !== undefined) hoaDon.chinhSachThanhToan = chinhSachThanhToan;

      // 3. XỬ LÝ UPDATE TÀI CHÍNH & THỜI GIAN (CHỈ KHI CHƯA THANH TOÁN)
      if (!isPaid) {
        if (chietKhau !== undefined && Number(chietKhau) < 0) throw new Error("Chiết khấu không hợp lệ");
        if (thue !== undefined && Number(thue) < 0) throw new Error("Thuế không hợp lệ");
        if (chiPhiKhac !== undefined && Number(chiPhiKhac) < 0) throw new Error("Chi phí khác không hợp lệ");

        if (thue !== undefined) hoaDon.thue = Number(thue);
        if (chiPhiKhac !== undefined) hoaDon.chiPhiKhac = Number(chiPhiKhac);
        if (chietKhau !== undefined) hoaDon.chietKhau = Number(chietKhau);

        // 🔥 Cập nhật ngày xuất hóa đơn an toàn
        if (ngayXuatHoaDon) {
          hoaDon.ngayXuatHoaDon = new Date(ngayXuatHoaDon);
        }

        // TH1: FE gửi danh sách đơn hàng mới -> Rebuild toàn bộ
        if (danhSachDonHangIds) {
          const oldDonHangIds = [...new Set(hoaDon.danhSachSanPham.map((sp) => sp.donHang.toString()))];
          const newDonHangIds = danhSachDonHangIds.map((id) => id.toString());

          const removedIds = oldDonHangIds.filter((id) => !newDonHangIds.includes(id));
          if (removedIds.length > 0) {
            await DonHang.updateMany({ _id: { $in: removedIds } }, { $set: { daXuatHoaDon: false } }, { session });
          }
          await DonHang.updateMany({ _id: { $in: newDonHangIds } }, { $set: { daXuatHoaDon: true } }, { session });

          const { danhSachSanPham, tongCong } = await buildDanhSachSanPham(newDonHangIds, hoaDon.nhaKhoa, session);
          hoaDon.danhSachSanPham = danhSachSanPham;
          hoaDon.tongCong = roundMoney(tongCong);
        }
        // TH2: FE gửi danhSachSanPham để update giảm giá / ghi chú từng SP
        else if (danhSachSanPhamMoi?.length) {
          danhSachSanPhamMoi.forEach((spMoi) => {
            const sp = hoaDon.danhSachSanPham.find((s) =>
              spMoi.sanPhamDonHangId
                ? s.sanPhamDonHangId?.toString() === spMoi.sanPhamDonHangId.toString()
                : s.donHang.toString() === spMoi.donHang?.toString() &&
                s.sanPham.toString() === spMoi.sanPham?.toString()
            );

            if (!sp) return;

            if (spMoi.giamGia !== undefined) {
              const giamGiaTien = Math.max(0, Number(spMoi.giamGia));
              if (giamGiaTien > sp.thanhTienSnapshot) {
                throw new Error(`Giảm giá vượt quá thành tiền của sản phẩm: ${sp.tenSanPham}`);
              }
              sp.giamGia = roundMoney(giamGiaTien);
              sp.tongCongSanPham = roundMoney(sp.thanhTienSnapshot - sp.giamGia);
            }

            if (spMoi.loaiGiamGia !== undefined) sp.loaiGiamGia = spMoi.loaiGiamGia;
            if (spMoi.ghiChu !== undefined) sp.ghiChu = spMoi.ghiChu;
          });

          hoaDon.tongCong = roundMoney(
            hoaDon.danhSachSanPham.reduce((s, sp) => s + (sp.tongCongSanPham || 0), 0)
          );
        }

        // 4. KIỂM TRA TÍNH TOÀN VẸN
        if (hoaDon.chietKhau > hoaDon.tongCong) throw new Error("Chiết khấu vượt quá tổng cộng hóa đơn");
        if (hoaDon.tongCong < 0) throw new Error("Tổng cộng hóa đơn không được âm");

        hoaDon.giaTriThanhToan = calculateGiaTriThanhToan({
          tongCong: hoaDon.tongCong,
          chietKhau: hoaDon.chietKhau,
          thue: hoaDon.thue,
          chiPhiKhac: hoaDon.chiPhiKhac,
        });

        if (hoaDon.giaTriThanhToan < 0) throw new Error("Giá trị thanh toán cuối cùng không được âm");

        hoaDon.conLai = calculateConLai(hoaDon.giaTriThanhToan, hoaDon.daThanhToan);
        hoaDon.trangThai = autoTrangThai(hoaDon.conLai, hoaDon.daThanhToan);
      }

      await hoaDon.save({ session });
      updatedHoaDon = hoaDon;
    });

    res.json({ success: true, message: "Cập nhật hóa đơn thành công", data: updatedHoaDon });

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

      // Query kèm session để lock document trong transaction, chống Race condition 
      const hoaDon = await HoaDon.findById(id).session(session);
      if (!hoaDon) {
        throw new Error("Không tìm thấy hóa đơn");
      }

      if (tienThanhToan > hoaDon.conLai) {
        throw new Error(`Số tiền thanh toán (${tienThanhToan}) vượt quá nợ còn lại (${hoaDon.conLai})`);
      }

      // Tính toán an toàn
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

      // Chặn xóa dựa trên số tiền thay vì dựa trên chuỗi trạng thái (Tránh lỗi nếu đổi tên trạng thái sau này)
      if (hoaDon.daThanhToan > 0) {
        throw new Error("Không thể xóa hóa đơn đã có giao dịch thanh toán");
      }

      // Rollback trạng thái đơn hàng: Chuyển daXuatHoaDon về false (chờ xuất)
      const donHangIds = [...new Set(hoaDon.danhSachSanPham.map((sp) => sp.donHang.toString()))];
      await DonHang.updateMany(
        { _id: { $in: donHangIds } },
        { $set: { daXuatHoaDon: false } },
        { session }
      );

      // Xóa cứng
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
const mongoose = require("mongoose"); // Bổ sung dòng này để hết lỗi
const NhaKhoa = require("../models/NhaKhoa");
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const { getCongNoTatCaNhaKhoa } = require("../utils/congNo");
const { TRUONG_TU_CRM, dongBoNhaKhoaTuCrm, layKhachHangCrm, LoiNhaKhoaCrm } = require("../utils/nhaKhoaTuCrm");


// ================= CẤU HÌNH DAYJS =================
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const VN_TZ = "Asia/Ho_Chi_Minh";

// Không có API tạo nha khoa: nha khoa chỉ được thêm mới bên CRM, lab lấy về
// khi tạo đơn (taoNhaKhoaTuCrm) hoặc khi CRM gửi sang (/api/tich-hop/nha-khoa).

exports.getAllNhaKhoa = async (req, res) => {
  try {
    const [danhSach, danhSachCongNo, danhSachDonCuoi] = await Promise.all([
      NhaKhoa.find(),
      getCongNoTatCaNhaKhoa(),
      // Ngày nhận đơn gần nhất của từng nha khoa
      DonHang.aggregate([
        { $group: { _id: "$nhaKhoa", ngayDonCuoi: { $max: "$ngayNhan" } } },
      ]),
    ]);

    // Map công nợ theo nhaKhoaId để tra cứu O(1)
    const congNoMap = new Map(
      danhSachCongNo.map((item) => [item.nhaKhoaId.toString(), item.tongCongNo])
    );
    const donCuoiMap = new Map(
      danhSachDonCuoi
        .filter((item) => item._id)
        .map((item) => [item._id.toString(), item.ngayDonCuoi])
    );

    const data = danhSach.map((nk) => ({
      ...nk.toObject(),
      tongCongNo: congNoMap.get(nk._id.toString()) ?? 0,
      ngayDonCuoi: donCuoiMap.get(nk._id.toString()) ?? null,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= HÀM HỖ TRỢ: TẠO TÊN VIẾT TẮT =================
const taoTenVietTat = (ten, idFallback) => {
  if (!ten) return idFallback.toString().slice(-4).toUpperCase();
  return ten
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
    .replace(/[^a-zA-Z0-9]/g, "") // Bỏ khoảng trắng và ký tự đặc biệt
    .toUpperCase()
    .slice(0, 8); // Lấy tối đa 8 ký tự cho mã gọn gàng
};

exports.updateSoDuDauKy = async (req, res) => {
  try {
    const { id } = req.params;
    const { thang, nam, soTien } = req.body;

    if (!thang || !nam || soTien === undefined) {
      return res.status(400).json({ success: false, message: "Thiếu thang, nam hoặc soTien" });
    }

    let nhaKhoa = await NhaKhoa.findById(id);
    if (!nhaKhoa) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nha khoa" });
    }

    // ================= 2. XỬ LÝ HÓA ĐƠN SDDK =================
    const yy = String(nam).slice(-2);
    const mm = String(thang).padStart(2, "0");
    const uniqueSuffix = nhaKhoa._id.toString().slice(-8).toUpperCase();
    const soHoaDonSDDK = `SDDK-${mm}${yy}-${uniqueSuffix}`;

    const ngayXuat = dayjs
      .tz(`${nam}-${mm}-01`, VN_TZ)
      .subtract(1, "month")
      .date(11)
      .toDate();

    const hoaDonSDDK = await HoaDon.findOne({
      nhaKhoa: nhaKhoa._id,
      soHoaDon: { $regex: new RegExp(`^SDDK-${mm}${yy}`, "i") },
    });

    // ✅ CHẶN HOÀN TOÀN nếu đã có phiếu thu — không phân biệt soTien là 0 hay > 0
    if (hoaDonSDDK && (hoaDonSDDK.daThanhToan || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể chỉnh sửa SDDK tháng ${thang}/${nam} vì đã có phiếu thu thanh toán ${hoaDonSDDK.daThanhToan.toLocaleString("vi-VN")}đ. Vui lòng xóa phiếu thu trước.`,
      });
    }

    // ================= 1. LƯU VÀO BẢNG NHA KHOA =================
    // Build a clean array from existing data (filter out corrupted subdocs with missing thang/nam)
    const cleanArr = Array.isArray(nhaKhoa.soDuDauKy)
      ? nhaKhoa.soDuDauKy
        .filter((item) => item.thang != null && item.nam != null)
        .map((item) => ({ thang: item.thang, nam: item.nam, soTien: item.soTien || 0 }))
      : [];

    const existingIdx = cleanArr.findIndex(
      (item) => item.thang === Number(thang) && item.nam === Number(nam)
    );

    if (existingIdx !== -1) {
      cleanArr[existingIdx].soTien = Number(soTien);
    } else {
      cleanArr.push({ thang: Number(thang), nam: Number(nam), soTien: Number(soTien) });
    }

    // Use native driver to $set the entire array — bypasses Mongoose validation
    // and works even when the DB field is corrupted (stored as object instead of array)
    await NhaKhoa.collection.updateOne(
      { _id: nhaKhoa._id },
      { $set: { soDuDauKy: cleanArr } }
    );
    // Reload to return current state
    nhaKhoa = await NhaKhoa.findById(id);

    // ================= XỬ LÝ KHI soTien = 0 =================
    if (Number(soTien) === 0) {
      if (hoaDonSDDK) {
        await HoaDon.deleteOne({ _id: hoaDonSDDK._id });
      }
      return res.json({ success: true, data: nhaKhoa });
    }

    // ================= XỬ LÝ KHI soTien > 0 =================
    if (hoaDonSDDK) {
      hoaDonSDDK.soHoaDon = soHoaDonSDDK;
      hoaDonSDDK.tongCong = Number(soTien);
      hoaDonSDDK.giaTriThanhToan = Number(soTien);
      hoaDonSDDK.conLai = Number(soTien);
      hoaDonSDDK.trangThai = "Chưa thanh toán";
      await hoaDonSDDK.save();
    } else {
      const hoaDonMoi = new HoaDon({
        soHoaDon: soHoaDonSDDK,
        nhaKhoa: nhaKhoa._id,
        tuNgay: ngayXuat,
        denNgay: ngayXuat,
        ngayXuatHoaDon: ngayXuat,
        danhSachSanPham: [],
        tongCong: Number(soTien),
        giaTriThanhToan: Number(soTien),
        daThanhToan: 0,
        conLai: Number(soTien),
        chinhSachThanhToan: "Thanh toán ngay",
        ghiChuNoiBo: `Số dư công nợ chuyển giao tính đến tháng ${thang}/${nam}`,
        trangThai: "Chưa thanh toán",
      });
      await hoaDonMoi.save();
    }

    res.json({ success: true, data: nhaKhoa });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertGhiChu = async (req, res) => {
  try {
    const { id } = req.params;
    const { thang, nam, noiDung } = req.body;

    if (!thang || !nam) return res.status(400).json({ success: false, message: 'Thiếu thang/nam' });

    const nk = await NhaKhoa.findById(id);
    if (!nk) return res.status(404).json({ success: false, message: 'Không tìm thấy nha khoa' });

    const idx = nk.ghiChuThang.findIndex(g => g.thang === thang && g.nam === nam);
    if (idx >= 0) {
      nk.ghiChuThang[idx].noiDung = noiDung ?? '';
    } else {
      nk.ghiChuThang.push({ thang, nam, noiDung: noiDung ?? '' });
    }

    await nk.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateNhaKhoa = async (req, res) => {
  try {
    const { id } = req.params;

    // maCrm chỉ do đồng bộ CRM gán. Nha khoa đã liên kết CRM thì các trường
    // CRM quản lý (tên, SĐT, email, địa chỉ, tỉnh) phải sửa bên CRM.
    const data = { ...(req.body || {}) };
    delete data.maCrm;
    const hienTai = await NhaKhoa.findById(id).select("maCrm").lean();
    if (!hienTai) {
      return res.status(404).json({ message: "Không tìm thấy nha khoa" });
    }
    if (hienTai.maCrm) {
      for (const truong of Object.keys(TRUONG_TU_CRM)) delete data[truong];
    }

    const updated = await NhaKhoa.findByIdAndUpdate(
      id,
      data,
      {
        returnDocument: 'after', // trả về dữ liệu sau khi update
        runValidators: true, // chạy validate schema
      }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Không tìm thấy nha khoa",
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ================= XÓA NHA KHOA =================
exports.deleteNhaKhoa = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "ID nha khoa không hợp lệ" });
    }

    // Chặn xóa nếu nha khoa còn công nợ hoặc còn hóa đơn liên quan,
    // tránh mất dữ liệu lịch sử giao dịch không mong muốn.
    const [soHoaDonLienQuan, soDonHangLienQuan] = await Promise.all([
      HoaDon.countDocuments({ nhaKhoa: id }),
      DonHang.countDocuments({ nhaKhoa: id }),
    ]);
    if (soDonHangLienQuan > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì nha khoa này còn ${soDonHangLienQuan} đơn hàng liên quan.`,
      });
    }
    if (soHoaDonLienQuan > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì nha khoa này còn ${soHoaDonLienQuan} hóa đơn liên quan. Vui lòng xử lý hóa đơn trước khi xóa.`,
      });
    }

    const deleted = await NhaKhoa.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nha khoa" });
    }

    res.json({ success: true, message: "Đã xóa nha khoa thành công", data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo đơn mà gõ tên nha khoa chưa có bên lab: tìm khách hàng bên CRM (nơi
// duy nhất thêm mới nha khoa). Bỏ những khách hàng đã liên kết nha khoa lab.
//
// GET /api/nhakhoa/crm?q=<tên>
exports.timNhaKhoaBenCrm = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) return res.json([]);

  try {
    const khachHang = await layKhachHangCrm({ q });
    if (khachHang === null) {
      return res.status(503).json({ message: "Chưa cấu hình kết nối CRM" });
    }

    const daLienKet = new Set(
      (await NhaKhoa.find({ maCrm: { $type: "string" } }).select("maCrm").lean()).map((nk) => nk.maCrm)
    );
    res.json(
      khachHang
        .filter((kh) => !daLienKet.has(kh.crmId))
        .map((kh) => ({
          crmId: kh.crmId,
          ten: kh.ten,
          diaChi: kh.diaChi,
          soDienThoai: kh.soDienThoai,
          tinh: kh.tinh,
          giaiDoan: kh.giaiDoan,
        }))
    );
  } catch (err) {
    console.error("Lỗi tìm nha khoa bên CRM:", err);
    res.status(502).json({ message: "Không kết nối được CRM" });
  }
};

// Chọn 1 khách hàng CRM khi tạo đơn: lấy lại thông tin từ CRM theo id (không
// tin dữ liệu gửi từ trình duyệt) rồi tạo (hoặc liên kết) nha khoa bên lab.
//
// POST /api/nhakhoa/tu-crm  Body: { crmId }
exports.taoNhaKhoaTuCrm = async (req, res) => {
  const crmId = req.body?.crmId;
  if (typeof crmId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(crmId)) {
    return res.status(400).json({ message: "Khách hàng CRM không hợp lệ" });
  }

  let khachHang;
  try {
    khachHang = await layKhachHangCrm({ id: crmId });
  } catch (err) {
    console.error("Lỗi lấy khách hàng từ CRM:", err);
    return res.status(502).json({ message: "Không kết nối được CRM" });
  }
  if (khachHang === null) return res.status(503).json({ message: "Chưa cấu hình kết nối CRM" });
  if (khachHang.length === 0) return res.status(404).json({ message: "CRM không còn khách hàng này" });

  try {
    const { nhaKhoa, daTao } = await dongBoNhaKhoaTuCrm(khachHang[0], { taoMoi: true });
    res.status(daTao ? 201 : 200).json(nhaKhoa);
  } catch (err) {
    if (err instanceof LoiNhaKhoaCrm) return res.status(err.status).json({ message: err.message });
    console.error("Lỗi tạo nha khoa từ CRM:", err);
    res.status(500).json({ message: "Lỗi tạo nha khoa từ CRM" });
  }
};

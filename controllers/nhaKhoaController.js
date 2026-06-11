const mongoose = require("mongoose"); // Bổ sung dòng này để hết lỗi
const NhaKhoa = require("../models/NhaKhoa");
const HoaDon = require("../models/HoaDon");
const { getCongNoTatCaNhaKhoa } = require("../utils/congNo");


// ================= CẤU HÌNH DAYJS =================
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const VN_TZ = "Asia/Ho_Chi_Minh";

exports.createNhaKhoa = async (req, res) => {
  try {
    const data = await NhaKhoa.create(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllNhaKhoa = async (req, res) => {
  try {
    const [danhSach, danhSachCongNo] = await Promise.all([
      NhaKhoa.find(),
      getCongNoTatCaNhaKhoa(),
    ]);
 
    // Map công nợ theo nhaKhoaId để tra cứu O(1)
    const congNoMap = new Map(
      danhSachCongNo.map((item) => [item.nhaKhoaId.toString(), item.tongCongNo])
    );
 
    const data = danhSach.map((nk) => ({
      ...nk.toObject(),
      tongCongNo: congNoMap.get(nk._id.toString()) ?? 0,
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

    const updated = await NhaKhoa.findByIdAndUpdate(
      id,
      req.body,
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

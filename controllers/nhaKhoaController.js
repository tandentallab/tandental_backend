const mongoose = require("mongoose"); // Bổ sung dòng này để hết lỗi
const NhaKhoa = require("../models/NhaKhoa");
const HoaDon = require("../models/HoaDon");

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
    const data = await NhaKhoa.find();
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

  const session = await mongoose.startSession();
  try {
    let updatedNhaKhoa;

    await session.withTransaction(async () => {
      const { id } = req.params;
      const { thang, nam, soTien } = req.body;

      if (!thang || !nam || soTien === undefined) {
        throw new Error("Thiếu thang, nam hoặc soTien");
      }

      const nhaKhoa = await NhaKhoa.findById(id).session(session);
      if (!nhaKhoa) throw new Error("Không tìm thấy nha khoa");

      // ================= 1. LƯU VÀO BẢNG NHA KHOA =================
      if (!Array.isArray(nhaKhoa.soDuDauKy)) nhaKhoa.soDuDauKy = [];

      const existingIndex = nhaKhoa.soDuDauKy.findIndex(
        (item) => item.thang === Number(thang) && item.nam === Number(nam)
      );

      if (existingIndex !== -1) {
        nhaKhoa.soDuDauKy[existingIndex].soTien = Number(soTien); // Cập nhật
      } else {
        nhaKhoa.soDuDauKy.push({ thang: Number(thang), nam: Number(nam), soTien: Number(soTien) }); // Thêm mới
      }
      await nhaKhoa.save({ session });
      updatedNhaKhoa = nhaKhoa;

      // ================= 2. TẠO, CẬP NHẬT HOẶC XÓA HÓA ĐƠN ĐẦU KỲ (SDDK) =================

      const yy = String(nam).slice(-2);
      const mm = String(thang).padStart(2, "0");

      // 🔥 FIX BUG 1: Dùng đuôi ID của Nha Khoa thay vì Tên viết tắt để đảm bảo độc nhất 100%
      const uniqueSuffix = nhaKhoa._id.toString().slice(-8).toUpperCase();
      const soHoaDonSDDK = `SDDK-${mm}${yy}-${uniqueSuffix}`;

      const ngayXuat = dayjs.tz(`${nam}-${mm}-01`, VN_TZ)
        .subtract(1, 'month')
        .date(11)
        .toDate();

      // 🔥 FIX BUG 2: Tìm kiếm ĐÍCH DANH hóa đơn SDDK của ĐÚNG Nha Khoa này
      // Dùng regex để đảm bảo dù DB đang lưu mã cũ hay mã mới, nó vẫn tìm trúng phóc!
      let hoaDonSDDK = await HoaDon.findOne({
        nhaKhoa: nhaKhoa._id,
        soHoaDon: { $regex: new RegExp(`^SDDK-${mm}${yy}`, 'i') }
      }).session(session);

      // 🔥 LOGIC MỚI: XỬ LÝ KHI KẾ TOÁN NHẬP SỐ 0
      if (Number(soTien) === 0) {
        if (hoaDonSDDK) {
          // Nếu đã trả tiền thì cấm xóa/cấm set về 0
          if ((hoaDonSDDK.daThanhToan || 0) > 0) {
            throw new Error(`Không thể hủy nợ vì khách đã thanh toán ${hoaDonSDDK.daThanhToan.toLocaleString('vi-VN')}đ cho khoản này!`);
          }
          // XÓA LUÔN HÓA ĐƠN NÀY CHO SẠCH DATABASE
          await HoaDon.deleteOne({ _id: hoaDonSDDK._id }).session(session);
        }
        // (Nếu chưa có hóa đơn mà nhập 0 thì hệ thống cũng không làm gì cả, không sinh rác)
      }
      // 🔥 LOGIC CŨ: KHI KẾ TOÁN NHẬP SỐ LỚN HƠN 0
      else {
        if (hoaDonSDDK) {
          if (Number(soTien) < (hoaDonSDDK.daThanhToan || 0)) {
            throw new Error(`Không thể giảm nợ xuống dưới số tiền đã trả (${hoaDonSDDK.daThanhToan.toLocaleString('vi-VN')}đ)!`);
          }
          // Lỡ DB đang lưu mã cũ, ta cập nhật lại thành mã mới cho chuẩn luôn
          hoaDonSDDK.soHoaDon = soHoaDonSDDK;
          hoaDonSDDK.tongCong = Number(soTien);
          hoaDonSDDK.giaTriThanhToan = Number(soTien);
          await hoaDonSDDK.save({ session });
        } else {
          hoaDonSDDK = new HoaDon({
            soHoaDon: soHoaDonSDDK,
            nhaKhoa: nhaKhoa._id,
            tuNgay: ngayXuat,
            denNgay: ngayXuat,
            ngayXuatHoaDon: ngayXuat,
            danhSachSanPham: [],
            tongCong: Number(soTien),
            giaTriThanhToan: Number(soTien),
            daThanhToan: 0,
            chinhSachThanhToan: "Thanh toán ngay",
            ghiChuNoiBo: `Số dư công nợ chuyển giao tính đến tháng ${thang}/${nam}`,
          });
          await hoaDonSDDK.save({ session });
        }
      }
    });

    res.json({ success: true, data: updatedNhaKhoa });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
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
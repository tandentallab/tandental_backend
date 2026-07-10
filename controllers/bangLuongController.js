const BangLuong = require("../models/BangLuong");
const NhanVien = require("../models/NhanVien");

// ================= TÍNH LƯƠNG / CẬP NHẬT LƯƠNG =================
exports.createBangLuong = async (req, res) => {
  try {
    const {
      thang,
      nam,
      nhanVien,
      soNgayCong,
      phuCapCom,
      phuCapDienThoai,
      thuong,
      phat,
      ungTruoc,
      ghiChu,
    } = req.body;

    // 1. Kiểm tra nhân viên tồn tại
    const nv = await NhanVien.findById(nhanVien);

    if (!nv) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên",
      });
    }

    // 2. 🔥 Lấy số ngày công quy chuẩn từ Model Nhân Viên (Mặc định là 28 nếu thiếu)
    const ngayCongTieuChuan = nv.ngayCongThang || 28;

    // 3. Tính toán lương theo ngày công thực tế của nhân viên đó
    const luongMotNgay = nv.luongCanBan / ngayCongTieuChuan;

    // Tiền công thực tế dựa trên số ngày đi làm
    const thanhTienCong = luongMotNgay * soNgayCong;

    // Tổng các khoản phụ cấp và thưởng cộng thêm
    const tongPhuCap =
      Number(phuCapCom || 0) +
      Number(phuCapDienThoai || 0) +
      Number(thuong || 0);

    // Tổng thu nhập trước giảm trừ
    const tongLuong = thanhTienCong + tongPhuCap;

    // Thực nhận sau khi trừ các khoản phạt hoặc ứng trước
    const thucNhan =
      tongLuong - Number(ungTruoc || 0) - Number(phat || 0);

    // 4. Kiểm tra xem bảng lương tháng này của nhân viên đã tồn tại chưa
    let bangLuong = await BangLuong.findOne({
      thang,
      nam,
      nhanVien,
    });


    // ================= TRƯỜNG HỢP CẬP NHẬT (UPDATE) =================
    if (bangLuong) {
      bangLuong.soNgayCong = soNgayCong;
      bangLuong.phuCapCom = phuCapCom;
      bangLuong.phuCapDienThoai = phuCapDienThoai;
      bangLuong.thuong = thuong;
      bangLuong.phat = phat;
      bangLuong.ungTruoc = ungTruoc;
      bangLuong.ghiChu = ghiChu;
      
      // Đồng bộ lại dữ liệu gốc từ hồ sơ nhân viên thời điểm tính lương
      bangLuong.luongCanBan = nv.luongCanBan;
      bangLuong.ngayCongThang = ngayCongTieuChuan;  // ✅ thêm dòng này
      bangLuong.luongMotNgay = luongMotNgay;
      bangLuong.thanhTienCong = thanhTienCong;
      bangLuong.tongPhuCap = tongPhuCap;
      bangLuong.tongLuong = tongLuong;
      bangLuong.thucNhan = thucNhan;

      await bangLuong.save();

      bangLuong = await BangLuong.findById(bangLuong._id).populate("nhanVien");

      return res.json({
        success: true,
        type: "update",
        message: "Cập nhật bảng lương thành công",
        data: bangLuong,
      });
    }

    // ================= TRƯỜNG HỢP TẠO MỚI (CREATE) =================
    bangLuong = await BangLuong.create({
      thang,
      nam,
      nhanVien,
      luongCanBan: nv.luongCanBan,
      ngayCongThang: ngayCongTieuChuan,  // ✅ thêm dòng này
      luongMotNgay,
      soNgayCong,
      thanhTienCong,
      phuCapCom,
      phuCapDienThoai,
      thuong,
      phat,
      ungTruoc,
      tongPhuCap,
      tongLuong,
      thucNhan,
      ghiChu,
    });

    bangLuong = await BangLuong.findById(bangLuong._id).populate("nhanVien");

    res.json({
      success: true,
      type: "create",
      message: "Tạo bảng lương thành công",
      data: bangLuong,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= DANH SÁCH BẢNG LƯƠNG =================
exports.getAllBangLuong = async (req, res) => {
  try {
    const { thang, nam, nhanVien } = req.query;

    let query = {};

    if (thang) query.thang = thang;
    if (nam) query.nam = nam;
    if (nhanVien) query.nhanVien = nhanVien;

    const data = await BangLuong.find(query)
      .populate("nhanVien")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CHI TIẾT BẢNG LƯƠNG =================
exports.getBangLuongById = async (req, res) => {
  try {
    const data = await BangLuong.findById(req.params.id).populate("nhanVien");

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= XÓA 1 BẢNG LƯƠNG =================
exports.deleteBangLuong = async (req, res) => {
  try {
    await BangLuong.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Xóa bảng lương thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= XÓA TẤT CẢ BẢNG LƯƠNG THEO THÁNG/NĂM =================
exports.deleteBangLuongByMonthYear = async (req, res) => {
  try {
    const { thang, nam } = req.query;

    if (!thang || !nam) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng truyền tháng và năm",
      });
    }

    const result = await BangLuong.deleteMany({ thang, nam });

    res.json({
      success: true,
      message: `Đã xóa ${result.deletedCount} bảng lương`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= LỊCH SỬ LƯƠNG CĂN BẢN THEO KHOẢNG THỜI GIAN =================
// Trả về toàn bộ bảng lương (đã populate nhân viên) trong khoảng [tuThang/tuNam -> denThang/denNam]
// Frontend sẽ tự dựng bảng pivot: hàng = nhân viên, cột = tháng
exports.getLichSuLuong = async (req, res) => {
  try {
    let { tuThang, tuNam, denThang, denNam } = req.query;

    tuThang = Number(tuThang);
    tuNam = Number(tuNam);
    denThang = Number(denThang);
    denNam = Number(denNam);

    if (!tuThang || !tuNam || !denThang || !denNam) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng truyền đủ tuThang, tuNam, denThang, denNam",
      });
    }

    // Quy đổi (tháng, năm) -> 1 số nguyên tăng dần để so sánh & lặp khoảng thời gian
    const start = tuNam * 12 + tuThang;
    const end = denNam * 12 + denThang;

    if (start > end) {
      return res.status(400).json({
        success: false,
        message:
          "Khoảng thời gian không hợp lệ (Từ tháng phải trước hoặc bằng Đến tháng)",
      });
    }

    // Danh sách toàn bộ {thang, nam} nằm trong khoảng đã chọn
    const periods = [];
    for (let key = start; key <= end; key++) {
      const nam = Math.floor((key - 1) / 12);
      const thang = key - nam * 12;
      periods.push({ thang, nam });
    }

    const data = await BangLuong.find({ $or: periods })
      .populate("nhanVien")
      .sort({ nam: 1, thang: 1 });

    res.json({
      success: true,
      periods,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
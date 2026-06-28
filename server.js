require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const connectDB = require("./config/db.config");
//Cac routes
const staffRoutes = require("./routes/staffRoutes");
const nhaKhoaRoutes = require("./routes/nhaKhoaRoutes");
const nguoiLienHeRoutes = require("./routes/nguoiLienHeRoutes");
const benhNhanRoutes = require("./routes/benhNhanRoutes");
const sanPhamRoutes = require("./routes/sanPhamRoutes");
const congDoanRoutes = require("./routes/congDoanRoutes");
const chamSocRoutes = require("./routes/chamSocKhachHangRoutes");
const bangGiaRoutes = require("./routes/bangGiaRoutes");
const donHangRoutes = require("./routes/donHangRoutes");
const hoaDonRoutes = require("./routes/hoaDonRoutes");
const quyenSuDungRoutes = require("./routes/quyenSuDungRoutes");
const congTyRoutes = require("./routes/congTyRoutes");
const khoRoutes = require("./routes/khoRoutes");
const phieuNhapKhoRoutes = require('./routes/phieuNhapKhoRoutes');
const phieuXuatKhoRoutes = require('./routes/phieuXuatKhoRoutes');
const phieuBaoHanhRoutes = require("./routes/phieuBaoHanhRoutes");
const mauTheBaoHanhRoutes = require("./routes/mauTheBaoHanhRoutes");
const publicRoutes = require("./routes/publicRoutes");
const baoCaoRoutes = require('./routes/baoCaoRoutes');
const phieuThuRoutes = require("./routes/phieuThuRoutes");
const dashboardRoutes = require('./routes/dashboardRoutes');
const nhanVienRoutes = require("./routes/nhanVienRoutes");
const bangLuongRoutes = require("./routes/bangLuongRoutes");
const searchRoutes = require("./routes/searchRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const ghiChuRoutes = require("./routes/ghiChuRoutes");
const chiPhiRoutes = require('./routes/chiPhiRoutes');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// test
app.get("/", (req, res) => {
  res.send("API OK");
});

// Serve logo for Excel export
app.get("/assets/logo.png", (req, res) => {
  res.sendFile(path.join(__dirname, "Picture1.png"));
});

const PORT = process.env.PORT || 3000;

// 🔥 start server đúng chuẩn
const startServer = async () => {
  try {
    await connectDB();

    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/staff", staffRoutes);
    app.use("/api/nhakhoa", nhaKhoaRoutes);
    app.use("/api/nguoilienhe", nguoiLienHeRoutes);
    app.use("/api/benhnhan", benhNhanRoutes);
    app.use("/api/sanpham", sanPhamRoutes);
    app.use("/api/congdoan", congDoanRoutes);
    app.use("/api/cham-soc-khach-hang", chamSocRoutes);
    app.use("/api/bang-gia", bangGiaRoutes);
    app.use("/api/donhang", donHangRoutes);
    app.use("/api/hoa-don", hoaDonRoutes);
    app.use("/api/quyen-su-dung", quyenSuDungRoutes);
    app.use("/api/cong-ty", congTyRoutes);
    app.use("/api/kho", khoRoutes);
    app.use("/api/phieu-nhap-kho", phieuNhapKhoRoutes);
    app.use("/api/phieu-xuat-kho", phieuXuatKhoRoutes);
    app.use("/api/phieu-bao-hanh", phieuBaoHanhRoutes);
    app.use("/api/mau-the-bao-hanh", mauTheBaoHanhRoutes);
    app.use("/api/public", publicRoutes);
    app.use("/api/phieu-thu", phieuThuRoutes);
    app.use("/api/baocao", baoCaoRoutes);
    app.use("/api/nhan-vien", nhanVienRoutes);
    app.use("/api/bang-luong", bangLuongRoutes);
    app.use("/api/search", searchRoutes);
    app.use('/api/chiphi', chiPhiRoutes);
    app.use(
      "/api/uploads",
      express.static(path.join(__dirname, "public/uploads"))
    );
    app.use("/api/activity-logs", activityLogRoutes);
    app.use("/api/ghi-chu", ghiChuRoutes);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on ${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
};


startServer();

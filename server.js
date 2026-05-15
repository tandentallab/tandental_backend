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
const nhaCungCapRoutes = require("./routes/nhaCungCapRoutes");
const phieuBaoHanhRoutes = require("./routes/phieuBaoHanhRoutes");
const publicRoutes = require("./routes/publicRoutes");
const baoCaoRoutes = require('./routes/baoCaoRoutes');
const phieuThuRoutes = require("./routes/phieuThuRoutes");
const dashboardRoutes = require('./routes/dashboardRoutes');
const nhanVienRoutes = require("./routes/nhanVienRoutes");
const bangLuongRoutes = require("./routes/bangLuongRoutes");


const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://tan-dental-frontend-snmb.vercel.app",
  "https://tan-dental-frontend-yzw6.vercel.app",
  process.env.ADMIN_FRONTEND_URL,
  process.env.PUBLIC_FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

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
    app.use("/api/nha-cung-cap", nhaCungCapRoutes);
    app.use("/api/phieu-bao-hanh", phieuBaoHanhRoutes);
    app.use("/api/public", publicRoutes);
    app.use("/api/phieu-thu", phieuThuRoutes);
    app.use("/api/baocao", baoCaoRoutes);
    app.use("/api/nhan-vien", nhanVienRoutes);
    app.use("/api/bang-luong", bangLuongRoutes);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
};

startServer();
require("dotenv").config();
const express = require("express");
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

const app = express();

app.use(cors());
app.use(express.json());

// test
app.get("/", (req, res) => {
  res.send("API OK");
});

const PORT = process.env.PORT || 3000;

// 🔥 start server đúng chuẩn
const startServer = async () => {
  try {
    await connectDB();

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
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
};

startServer();
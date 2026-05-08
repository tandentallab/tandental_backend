require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db.config");
const QuyenSuDung = require("./models/QuyenSuDung");

const seedQuyens = async () => {
  try {
    await connectDB();

    // Xoá tất cả dữ liệu cũ
    await QuyenSuDung.deleteMany({});

    const quyens = [
      {
        ten: "Admin",
        moTa: "Quyền quản trị viên - toàn quyền hệ thống",
      },
      {
        ten: "Quản lý",
        moTa: "Quản lý dự án và nhân viên",
      },
      {
        ten: "Nhân viên",
        moTa: "Nhân viên thường - quyền cơ bản",
      },
      {
        ten: "Nha khoa",
        moTa: "Quản lý nha khoa",
      },
      {
        ten: "Kỹ thuật viên",
        moTa: "Kỹ thuật viên - quản lý sản xuất",
      },
    ];

    await QuyenSuDung.insertMany(quyens);

    console.log("✅ Seed dữ liệu quyền sử dụng thành công!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi seed dữ liệu:", error);
    process.exit(1);
  }
};

seedQuyens();

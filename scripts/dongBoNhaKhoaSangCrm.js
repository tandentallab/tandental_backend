// Chỉ dùng khi chuyển dữ liệu cũ: gửi các nha khoa CHƯA liên kết CRM sang CRM
// (chỉ tên) để CRM tạo khách hàng mã "LAB-<id>". Sau đó chạy
// scripts/lienKetNhaKhoaCrm.js để liên kết. CRM tự bỏ qua nha khoa đã có.
// Từ nay nha khoa chỉ được thêm mới bên CRM.
//
// Chạy trong thư mục backend: node scripts/dongBoNhaKhoaSangCrm.js

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db.config");
const NhaKhoa = require("../models/NhaKhoa");
const { guiNhaKhoaSangCrm } = require("../utils/crmNhaKhoa");

const main = async () => {
  await connectDB();
  const danhSach = await NhaKhoa.find({ maCrm: { $not: { $type: "string" } } }).select("hoVaTen").lean();
  console.log(`Tìm thấy ${danhSach.length} nha khoa chưa liên kết CRM`);

  const ketQua = await guiNhaKhoaSangCrm(danhSach);
  if (!ketQua) {
    throw new Error("Thiếu CRM_API_URL hoặc CRM_API_KEY trong .env");
  }
  console.log(`CRM đã tạo ${ketQua.daTao}, bỏ qua ${ketQua.boQua}`);
};

main()
  .catch((error) => {
    console.error("Đồng bộ thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

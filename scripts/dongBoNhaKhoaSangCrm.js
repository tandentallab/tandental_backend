// Gửi toàn bộ nha khoa sang CRM (chỉ tên). Dùng cho lần import đầu tiên, và chạy
// lại được bất cứ lúc nào để bù các nha khoa gửi lỗi — CRM tự bỏ qua nha khoa đã có.
//
// Chạy trong thư mục backend: node scripts/dongBoNhaKhoaSangCrm.js

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db.config");
const NhaKhoa = require("../models/NhaKhoa");
const { guiNhaKhoaSangCrm } = require("../utils/crmNhaKhoa");

const main = async () => {
  await connectDB();
  const danhSach = await NhaKhoa.find().select("hoVaTen").lean();
  console.log(`Tìm thấy ${danhSach.length} nha khoa`);

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

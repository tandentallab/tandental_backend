// Gửi toàn bộ giá riêng hiện có ở lab sang CRM (lần import đầu tiên). CRM ghi
// mỗi giá thành 1 đề xuất giá đã duyệt. Chạy lại được: giá CRM đang áp dụng đã
// bằng giá lab thì bỏ qua. Sau lần này, giá riêng chỉnh ở CRM rồi bấm "Đồng bộ
// sang lab" ở trang khách hàng.
//
// Chạy trong thư mục backend: node scripts/dongBoBangGiaSangCrm.js
// Cần chạy dongBoNhaKhoaSangCrm.js trước để CRM đã có đủ nha khoa.

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db.config");
const NhaKhoa = require("../models/NhaKhoa");
const SanPham = require("../models/SanPham");
const BangGia = require("../models/BangGia");

const CRM_TIMEOUT_MS = 30000;

const guiGiaRieng = async (nhaKhoa, giaRieng) => {
  const response = await fetch(new URL("/api/tich-hop/gia-rieng", process.env.CRM_API_URL), {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.CRM_API_KEY },
    body: JSON.stringify({ maKhachHang: `LAB-${nhaKhoa._id}`, ten: nhaKhoa.hoVaTen, giaRieng }),
    signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
  });
  const ketQua = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(ketQua?.error || `CRM trả về lỗi ${response.status}`);
  }
  return ketQua;
};

const main = async () => {
  if (!process.env.CRM_API_URL || !process.env.CRM_API_KEY) {
    throw new Error("Thiếu CRM_API_URL hoặc CRM_API_KEY trong .env");
  }
  await connectDB();

  const [danhSachGia, danhSachNhaKhoa, danhSachSanPham] = await Promise.all([
    BangGia.find().select("nhaKhoaId sanPhamId donGia").lean(),
    NhaKhoa.find().select("hoVaTen").lean(),
    SanPham.find({ khongDongBoCrm: { $ne: true } }).select("tenSanPham").lean(),
  ]);
  const nhaKhoaTheoId = new Map(danhSachNhaKhoa.map((nk) => [nk._id.toString(), nk]));
  const tenSanPham = new Map(danhSachSanPham.map((sp) => [sp._id.toString(), sp.tenSanPham]));

  const giaTheoNhaKhoa = new Map();
  for (const gia of danhSachGia) {
    const ten = tenSanPham.get(gia.sanPhamId.toString());
    if (!ten) continue; // sản phẩm đã bị xoá hoặc không đồng bộ sang CRM
    const key = gia.nhaKhoaId.toString();
    if (!giaTheoNhaKhoa.has(key)) giaTheoNhaKhoa.set(key, []);
    giaTheoNhaKhoa.get(key).push({ sanPham: ten, donGia: gia.donGia });
  }
  console.log(`Tìm thấy ${giaTheoNhaKhoa.size} nha khoa có giá riêng`);

  let tongTao = 0;
  let soLoi = 0;
  const sanPhamKhongKhop = new Set();
  for (const [nhaKhoaId, giaRieng] of giaTheoNhaKhoa) {
    const nhaKhoa = nhaKhoaTheoId.get(nhaKhoaId);
    if (!nhaKhoa) continue; // nha khoa đã bị xoá
    try {
      const ketQua = await guiGiaRieng(nhaKhoa, giaRieng);
      tongTao += ketQua.daTao;
      ketQua.khongKhop.forEach((ten) => sanPhamKhongKhop.add(ten));
      console.log(`${nhaKhoa.hoVaTen}: tạo ${ketQua.daTao}, không đổi ${ketQua.khongDoi}, không khớp ${ketQua.khongKhop.length}`);
    } catch (error) {
      soLoi++;
      console.error(`${nhaKhoa.hoVaTen}: LỖI ${error.message}`);
    }
  }

  console.log(`\nXong: CRM tạo ${tongTao} giá riêng, ${soLoi} nha khoa bị lỗi.`);
  if (sanPhamKhongKhop.size > 0) {
    console.log(`Sản phẩm CRM không có trong bảng giá chuẩn (bị bỏ qua):\n- ${[...sanPhamKhongKhop].join("\n- ")}`);
  }
  if (soLoi > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error("Đồng bộ thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

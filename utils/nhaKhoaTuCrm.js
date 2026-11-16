const mongoose = require("mongoose");
const NhaKhoa = require("../models/NhaKhoa");
const { chuanHoaTen } = require("./chuanHoaTen");

// CRM quản lý nha khoa: chỉ CRM tạo mới, và CRM là nguồn của các trường trong
// TRUONG_TU_CRM. Lab chỉ quản lý những gì sinh ra từ nha khoa (đơn hàng, hoá
// đơn, công nợ, ghi chú...). Nha khoa bên lab gắn với khách hàng CRM qua
// NhaKhoa.maCrm (id khách hàng bên CRM).
//
// Nha khoa đến lab theo 3 đường, đều đi qua dongBoNhaKhoaTuCrm:
//  - tạo đơn mà nha khoa chưa có: lab lấy khách hàng từ CRM về (nhaKhoaController)
//  - CRM bấm "Gửi sang lab" hoặc sửa khách hàng (POST /api/tich-hop/nha-khoa)
//  - script liên kết dữ liệu cũ (scripts/lienKetNhaKhoaCrm.js)

const CRM_TIMEOUT_MS = 15000;
const MAX_TEXT_LENGTH = 500;

// Trường do CRM quản lý: tên trường bên lab -> tên trường trong dữ liệu CRM.
// Lab không cho sửa các trường này ở nha khoa đã liên kết CRM.
const TRUONG_TU_CRM = {
  hoVaTen: "ten",
  soDienThoai: "soDienThoai",
  email: "email",
  diaChiCuThe: "diaChi",
  tinh: "tinh",
};

class LoiNhaKhoaCrm extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const chuoi = (value) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_TEXT_LENGTH) : undefined;

const laMaCrmHopLe = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

// Lấy các trường CRM có giá trị. Trường trống bên CRM không ghi đè dữ liệu
// lab (khách hàng CRM tạo từ lab trước đây thường chưa có SĐT, địa chỉ).
const truongTuCrm = (khachHang) => {
  const data = {};
  for (const [truongLab, truongCrm] of Object.entries(TRUONG_TU_CRM)) {
    const value = chuoi(khachHang[truongCrm]);
    if (value !== undefined) data[truongLab] = value;
  }
  return data;
};

// Tìm nha khoa ứng với 1 khách hàng CRM, theo thứ tự:
//  1. maCrm (đã liên kết)
//  2. mã khách hàng "LAB-<id nha khoa>" (khách hàng CRM tạo từ lab) — chỉ khi
//     nha khoa đó chưa liên kết với khách hàng CRM khác
//  3. trùng đúng 1 tên trong các nha khoa chưa liên kết
// Trả { nhaKhoa, soTrungTen }; soTrungTen > 1 nghĩa là không biết chọn nha khoa nào.
const timNhaKhoaCuaKhachHang = async ({ crmId, maKhachHang, ten }) => {
  if (laMaCrmHopLe(crmId)) {
    const theoMaCrm = await NhaKhoa.findOne({ maCrm: crmId });
    if (theoMaCrm) return { nhaKhoa: theoMaCrm, soTrungTen: 1 };
  }

  const chuaLienKet = (nk) => !nk.maCrm || nk.maCrm === crmId;

  const idLab = typeof maKhachHang === "string" && maKhachHang.startsWith("LAB-") ? maKhachHang.slice(4) : null;
  if (idLab && mongoose.isValidObjectId(idLab)) {
    const theoId = await NhaKhoa.findById(idLab);
    if (theoId && chuaLienKet(theoId)) return { nhaKhoa: theoId, soTrungTen: 1 };
  }

  if (typeof ten !== "string" || !ten.trim()) return { nhaKhoa: null, soTrungTen: 0 };
  const tenCanTim = chuanHoaTen(ten);
  const danhSach = await NhaKhoa.find().select("hoVaTen maCrm").lean();
  const khop = danhSach.filter((nk) => chuaLienKet(nk) && chuanHoaTen(nk.hoVaTen || "") === tenCanTim);
  if (khop.length !== 1) return { nhaKhoa: null, soTrungTen: khop.length };
  return { nhaKhoa: await NhaKhoa.findById(khop[0]._id), soTrungTen: 1 };
};

// Dùng cho nhận bảng giá từ CRM: chỉ cần tìm, không liên kết.
const timNhaKhoa = async ({ crmId, maKhachHang, ten }) =>
  (await timNhaKhoaCuaKhachHang({ crmId, maKhachHang, ten })).nhaKhoa;

// Tạo hoặc cập nhật nha khoa từ 1 khách hàng CRM
// ({ crmId, maKhachHang, ten, soDienThoai, email, diaChi, tinh }).
// Nha khoa đã có thì liên kết maCrm (nếu chưa) và cập nhật các trường CRM.
// taoMoi = false: chưa có thì bỏ qua (dùng khi CRM chỉ báo sửa thông tin).
// Trả { nhaKhoa, daTao } (nhaKhoa = null nếu bỏ qua).
const dongBoNhaKhoaTuCrm = async (khachHang, { taoMoi }) => {
  const { crmId, ten } = khachHang;
  if (!laMaCrmHopLe(crmId)) {
    throw new LoiNhaKhoaCrm("Thiếu id khách hàng CRM", 400);
  }
  if (typeof ten !== "string" || !ten.trim() || ten.trim().length > MAX_TEXT_LENGTH) {
    throw new LoiNhaKhoaCrm("Tên nha khoa không hợp lệ", 400);
  }

  const data = { ...truongTuCrm(khachHang), maCrm: crmId };
  const { nhaKhoa: daCo, soTrungTen } = await timNhaKhoaCuaKhachHang(khachHang);

  if (daCo) {
    daCo.set(data);
    if (daCo.isModified()) await daCo.save();
    return { nhaKhoa: daCo, daTao: false };
  }
  if (soTrungTen > 1) {
    throw new LoiNhaKhoaCrm(
      `Phần mềm lab có ${soTrungTen} nha khoa trùng tên "${ten.trim()}" chưa liên kết CRM, cần xử lý bằng script liên kết`,
      409
    );
  }
  if (!taoMoi) return { nhaKhoa: null, daTao: false };

  try {
    return { nhaKhoa: await NhaKhoa.create(data), daTao: true };
  } catch (err) {
    // 2 yêu cầu tạo cùng lúc cho cùng 1 khách hàng: lấy bản đã tạo.
    if (err?.code === 11000) {
      const daTaoTruoc = await NhaKhoa.findOne({ maCrm: crmId });
      if (daTaoTruoc) return { nhaKhoa: daTaoTruoc, daTao: false };
    }
    throw err;
  }
};

// Gọi GET <CRM_API_URL>/api/tich-hop/nha-khoa với query ({ q } | { id } | { tatCa: "1" }).
// Trả danh sách khách hàng CRM (có thêm crmId = id), hoặc null nếu chưa cấu hình CRM.
const layKhachHangCrm = async (query, { timeoutMs = CRM_TIMEOUT_MS } = {}) => {
  const { CRM_API_URL, CRM_API_KEY } = process.env;
  if (!CRM_API_URL || !CRM_API_KEY) return null;

  const url = new URL("/api/tich-hop/nha-khoa", CRM_API_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { "x-api-key": CRM_API_KEY },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`CRM trả về lỗi ${response.status}`);
  const payload = await response.json();
  const danhSach = Array.isArray(payload?.khachHang) ? payload.khachHang : [];
  return danhSach.map((kh) => ({ ...kh, crmId: kh.id }));
};

module.exports = {
  TRUONG_TU_CRM,
  LoiNhaKhoaCrm,
  timNhaKhoa,
  timNhaKhoaCuaKhachHang,
  dongBoNhaKhoaTuCrm,
  layKhachHangCrm,
  truongTuCrm,
};

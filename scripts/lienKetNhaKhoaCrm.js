// Liên kết nha khoa có sẵn bên lab với khách hàng CRM (gán NhaKhoa.maCrm) và
// lấy tên, SĐT, email, địa chỉ, tỉnh từ CRM (trường trống bên CRM không ghi đè).
//
// Ghép theo thứ tự:
//  1. khách hàng CRM mã "LAB-<id nha khoa>" (CRM tạo từ lab trước đây)
//  2. tên trùng nhau và chỉ có đúng 1 bên mỗi phía (chưa liên kết)
// Trường hợp trùng tên nhiều nha khoa hoặc nhiều khách hàng thì in ra để xử lý tay.
//
// Chạy trong thư mục backend:
//   node scripts/lienKetNhaKhoaCrm.js         -> chỉ in kết quả, không ghi gì
//   node scripts/lienKetNhaKhoaCrm.js --ghi   -> ghi liên kết vào database
//
// Nha khoa bên lab chưa có trên CRM: chạy scripts/dongBoNhaKhoaSangCrm.js để CRM
// tạo khách hàng, rồi chạy lại script này.

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db.config");
const NhaKhoa = require("../models/NhaKhoa");
const { chuanHoaTen } = require("../utils/chuanHoaTen");
const { layKhachHangCrm, truongTuCrm, TRUONG_TU_CRM } = require("../utils/nhaKhoaTuCrm");

const GHI = process.argv.includes("--ghi");

const nhomTheoTen = (danhSach, layTen) => {
  const map = new Map();
  for (const item of danhSach) {
    const key = chuanHoaTen(layTen(item) || "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
};

const main = async () => {
  const khachHang = await layKhachHangCrm({ tatCa: "1" }, { timeoutMs: 120000 });
  if (!khachHang) throw new Error("Thiếu CRM_API_URL hoặc CRM_API_KEY trong .env");

  await connectDB();
  const nhaKhoas = await NhaKhoa.find().select(["maCrm", ...Object.keys(TRUONG_TU_CRM)].join(" ")).lean();
  console.log(`CRM: ${khachHang.length} khách hàng. Lab: ${nhaKhoas.length} nha khoa.`);

  const daLienKet = new Set(nhaKhoas.filter((nk) => nk.maCrm).map((nk) => nk.maCrm));
  const nhaKhoaTheoId = new Map(nhaKhoas.map((nk) => [nk._id.toString(), nk]));
  const capGhep = []; // { nhaKhoa, kh, cach }
  const daGhepLab = new Set();
  const daGhepCrm = new Set();

  const ghep = (nhaKhoa, kh, cach) => {
    capGhep.push({ nhaKhoa, kh, cach });
    daGhepLab.add(nhaKhoa._id.toString());
    daGhepCrm.add(kh.crmId);
  };

  const khChuaLienKet = khachHang.filter((kh) => !daLienKet.has(kh.crmId));

  // 1. Theo mã "LAB-<id>"
  for (const kh of khChuaLienKet) {
    if (typeof kh.maKhachHang !== "string" || !kh.maKhachHang.startsWith("LAB-")) continue;
    const nk = nhaKhoaTheoId.get(kh.maKhachHang.slice(4));
    if (nk && !nk.maCrm && !daGhepLab.has(nk._id.toString())) ghep(nk, kh, "mã LAB");
  }

  // 2. Theo tên, chỉ khi mỗi bên đúng 1
  const labTheoTen = nhomTheoTen(
    nhaKhoas.filter((nk) => !nk.maCrm && !daGhepLab.has(nk._id.toString())),
    (nk) => nk.hoVaTen
  );
  const crmTheoTen = nhomTheoTen(
    khChuaLienKet.filter((kh) => !daGhepCrm.has(kh.crmId)),
    (kh) => kh.ten
  );
  const trungTen = [];
  for (const [ten, dsLab] of labTheoTen) {
    const dsCrm = crmTheoTen.get(ten) || [];
    if (dsCrm.length === 0) continue;
    if (dsLab.length === 1 && dsCrm.length === 1) ghep(dsLab[0], dsCrm[0], "tên");
    else trungTen.push({ ten: dsLab[0].hoVaTen, soLab: dsLab.length, soCrm: dsCrm.length });
  }

  console.log(`\n== Ghép được ${capGhep.length} nha khoa ==`);
  for (const { nhaKhoa, kh, cach } of capGhep) {
    const data = truongTuCrm(kh);
    const thayDoi = Object.entries(data)
      .filter(([truong, value]) => (nhaKhoa[truong] || "") !== value)
      .map(([truong, value]) => `${truong}: "${nhaKhoa[truong] || ""}" -> "${value}"`);
    console.log(`- [${cach}] ${nhaKhoa.hoVaTen} <-> CRM ${kh.maKhachHang}${thayDoi.length ? `\n    ${thayDoi.join("\n    ")}` : ""}`);
  }

  if (trungTen.length) {
    console.log(`\n== Trùng tên, cần xử lý tay (${trungTen.length}) ==`);
    for (const t of trungTen) console.log(`- "${t.ten}": ${t.soLab} nha khoa lab, ${t.soCrm} khách hàng CRM`);
  }

  const labConLai = nhaKhoas.filter((nk) => !nk.maCrm && !daGhepLab.has(nk._id.toString()));
  console.log(`\n== Nha khoa lab chưa có trên CRM (${labConLai.length}) ==`);
  for (const nk of labConLai) console.log(`- ${nk.hoVaTen || "(không tên)"} (${nk._id})`);

  if (!GHI) {
    console.log("\nChưa ghi gì. Chạy lại với --ghi để lưu liên kết.");
    return;
  }

  let daGhi = 0;
  for (const { nhaKhoa, kh } of capGhep) {
    // Chỉ ghi khi nha khoa vẫn chưa liên kết (phòng chạy song song với đồng bộ khác).
    const ketQua = await NhaKhoa.updateOne(
      { _id: nhaKhoa._id, maCrm: { $not: { $type: "string" } } },
      { $set: { ...truongTuCrm(kh), maCrm: kh.crmId } }
    );
    daGhi += ketQua.modifiedCount;
  }
  console.log(`\nĐã liên kết ${daGhi} nha khoa.`);
};

main()
  .catch((error) => {
    console.error("Liên kết thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

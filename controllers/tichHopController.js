const SanPham = require("../models/SanPham");
const BangGia = require("../models/BangGia");
const NhaKhoa = require("../models/NhaKhoa");
const DonHang = require("../models/DonHang");
const { chuanHoaTen } = require("../utils/chuanHoaTen");
const { timNhaKhoa, dongBoNhaKhoaTuCrm, LoiNhaKhoaCrm } = require("../utils/nhaKhoaTuCrm");

const MAX_ITEMS = 1000;

// Đơn vị tính bên CRM; "Khác" không có đơn vị.
const DON_VI_THEO_LOAI_TINH = {
  "Răng": "Răng",
  "Răng (không đếm)": "Răng",
  "Bán hàm": "Bán hàm",
  "Hàm": "Hàm",
};

// CRM lấy bảng giá chung (nút "Đồng bộ dữ liệu" ở trang Bảng giá bên CRM).
// Tên field theo đúng định dạng CRM đọc (crm/src/lib/product-sync.ts).
//
// GET /api/tich-hop/san-pham
exports.layBangGiaChung = async (req, res) => {
  try {
    const sanPhams = await SanPham.find()
      .select("tenSanPham donGiaChung loaiTinh nhomSanPham baoHanhMacDinh")
      .sort({ nhomSanPham: 1, tenSanPham: 1 })
      .lean();

    res.json({
      products: sanPhams.map((sp) => ({
        id: sp._id.toString(),
        productName: sp.tenSanPham,
        unitPrice: sp.donGiaChung,
        unit: DON_VI_THEO_LOAI_TINH[sp.loaiTinh] || null,
        category: sp.nhomSanPham || null,
        warrantyNote: sp.baoHanhMacDinh > 0 ? `Bảo hành ${sp.baoHanhMacDinh} năm` : null,
      })),
    });
  } catch (err) {
    console.error("Lỗi trả bảng giá chung cho CRM:", err);
    res.status(500).json({ message: "Phần mềm lab bị lỗi khi lấy bảng giá" });
  }
};

// CRM đẩy giá riêng của 1 nha khoa sang (nút "Đồng bộ sang lab" bên CRM).
// Chỉ thêm/ghi đè giá riêng, không xoá giá riêng nào đang có.
//
// POST /api/tich-hop/bang-gia
// Body: { crmId: "<id khách hàng CRM>", maKhachHang: "<mã KH>", ten: "<tên>",
//         giaRieng: [{ sanPham: "<tên sản phẩm>", donGia: 1200000 }] }
//
// Nha khoa tìm theo crmId (NhaKhoa.maCrm), rồi mã "LAB-<id>", rồi tên (phải
// khớp đúng 1 nha khoa chưa liên kết), xem utils/nhaKhoaTuCrm.js. Sản phẩm khớp theo tên; tên không khớp hoặc trùng nhiều
// sản phẩm được trả về trong khongKhop.
exports.nhanBangGiaTuCrm = async (req, res) => {
  try {
    const { crmId, maKhachHang, ten, giaRieng } = req.body || {};
    const hopLe =
      Array.isArray(giaRieng) &&
      giaRieng.length > 0 &&
      giaRieng.length <= MAX_ITEMS &&
      giaRieng.every(
        (item) =>
          typeof item?.sanPham === "string" &&
          item.sanPham.trim() &&
          typeof item.donGia === "number" &&
          Number.isFinite(item.donGia) &&
          item.donGia >= 0
      );
    if (!hopLe) {
      return res.status(400).json({ message: "Danh sách giá riêng không hợp lệ" });
    }

    const nhaKhoa = await timNhaKhoa({ crmId, maKhachHang, ten });
    if (!nhaKhoa) {
      return res.status(404).json({ message: "Phần mềm lab không tìm thấy nha khoa này" });
    }

    // Gom sản phẩm theo tên chuẩn hoá; tên trùng nhiều sản phẩm thì không biết
    // ghi vào sản phẩm nào nên coi như không khớp.
    const sanPhams = await SanPham.find().select("tenSanPham").lean();
    const sanPhamTheoTen = new Map();
    for (const sp of sanPhams) {
      const key = chuanHoaTen(sp.tenSanPham || "");
      sanPhamTheoTen.set(key, sanPhamTheoTen.has(key) ? null : sp._id);
    }

    const giaHienTai = await BangGia.find({ nhaKhoaId: nhaKhoa._id }).select("sanPhamId donGia").lean();
    const giaTheoSanPham = new Map(giaHienTai.map((g) => [g.sanPhamId.toString(), g.donGia]));

    const khongKhop = [];
    const thaoTac = [];
    const daXuLy = new Set();
    let khongDoi = 0;
    for (const { sanPham, donGia } of giaRieng) {
      const sanPhamId = sanPhamTheoTen.get(chuanHoaTen(sanPham));
      if (!sanPhamId) {
        khongKhop.push(sanPham.trim());
        continue;
      }
      const key = sanPhamId.toString();
      if (daXuLy.has(key) || giaTheoSanPham.get(key) === donGia) {
        khongDoi++;
        continue;
      }
      daXuLy.add(key);
      thaoTac.push({
        updateOne: {
          filter: { nhaKhoaId: nhaKhoa._id, sanPhamId },
          update: { $set: { donGia } },
          upsert: true,
        },
      });
    }

    if (thaoTac.length > 0) {
      await BangGia.bulkWrite(thaoTac);
    }

    res.json({ capNhat: thaoTac.length, khongDoi, khongKhop });
  } catch (err) {
    console.error("Lỗi nhận bảng giá từ CRM:", err);
    res.status(500).json({ message: "Phần mềm lab bị lỗi khi lưu bảng giá" });
  }
};

// CRM gửi 1 khách hàng sang: nút "Gửi sang lab" (tạo nếu chưa có), hoặc tự
// động sau khi sửa khách hàng (chiCapNhat = true: chỉ cập nhật nha khoa đã có,
// không tạo mới cho khách hàng chưa từng gửi đơn). Gọi lại nhiều lần vẫn an toàn.
//
// POST /api/tich-hop/nha-khoa
// Body: { crmId, maKhachHang, ten, soDienThoai?, email?, diaChi?, tinh?, chiCapNhat? }
// Trả về: { id, daTao } (id = null nếu chiCapNhat mà lab chưa có nha khoa này)
exports.nhanNhaKhoaTuCrm = async (req, res) => {
  try {
    const body = req.body || {};
    const { nhaKhoa, daTao } = await dongBoNhaKhoaTuCrm(body, { taoMoi: body.chiCapNhat !== true });
    res.status(daTao ? 201 : 200).json({ id: nhaKhoa ? nhaKhoa._id.toString() : null, daTao });
  } catch (err) {
    if (err instanceof LoiNhaKhoaCrm) return res.status(err.status).json({ message: err.message });
    console.error("Lỗi nhận nha khoa từ CRM:", err);
    res.status(500).json({ message: "Phần mềm lab bị lỗi khi lưu nha khoa" });
  }
};

// CRM lấy ngày nhận đơn gần nhất của từng nha khoa (đã liên kết CRM) để hiện
// số ngày nha khoa chưa gửi đơn. Nha khoa chưa có đơn nào thì không có trong danh sách.
//
// GET /api/tich-hop/ngay-don-cuoi
// Trả về: { nhaKhoa: [{ crmId, ngayDonCuoi }] }
exports.layNgayDonCuoi = async (req, res) => {
  try {
    const danhSach = await DonHang.aggregate([
      { $match: { nhaKhoa: { $ne: null }, ngayNhan: { $ne: null } } },
      { $group: { _id: "$nhaKhoa", ngayDonCuoi: { $max: "$ngayNhan" } } },
      { $lookup: { from: NhaKhoa.collection.name, localField: "_id", foreignField: "_id", as: "nk" } },
      { $unwind: "$nk" },
      { $match: { "nk.maCrm": { $type: "string" } } },
      { $project: { _id: 0, crmId: "$nk.maCrm", ngayDonCuoi: 1 } },
    ]);
    res.json({ nhaKhoa: danhSach });
  } catch (err) {
    console.error("Lỗi trả ngày đơn cuối cho CRM:", err);
    res.status(500).json({ message: "Phần mềm lab bị lỗi khi lấy ngày đơn cuối" });
  }
};

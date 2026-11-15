const mongoose = require("mongoose");
const NhaKhoa = require("../models/NhaKhoa");
const SanPham = require("../models/SanPham");
const BangGia = require("../models/BangGia");
const { chuanHoaTen } = require("../utils/chuanHoaTen");

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
// Body: { maKhachHang: "LAB-<id nha khoa>", ten: "<tên>",
//         giaRieng: [{ sanPham: "<tên sản phẩm>", donGia: 1200000 }] }
//
// Nha khoa tìm theo id trong mã "LAB-<id>", không có thì theo tên (phải khớp
// đúng 1 nha khoa). Sản phẩm khớp theo tên; tên không khớp hoặc trùng nhiều
// sản phẩm được trả về trong khongKhop.
exports.nhanBangGiaTuCrm = async (req, res) => {
  try {
    const { maKhachHang, ten, giaRieng } = req.body || {};
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

    const nhaKhoa = await timNhaKhoa(maKhachHang, ten);
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

const timNhaKhoa = async (maKhachHang, ten) => {
  const id = typeof maKhachHang === "string" && maKhachHang.startsWith("LAB-") ? maKhachHang.slice(4) : null;
  if (id && mongoose.isValidObjectId(id)) {
    const theoId = await NhaKhoa.findById(id).select("_id").lean();
    if (theoId) return theoId;
  }
  if (typeof ten !== "string" || !ten.trim()) return null;

  const tenCanTim = chuanHoaTen(ten);
  const danhSach = await NhaKhoa.find().select("hoVaTen").lean();
  const khop = danhSach.filter((nk) => chuanHoaTen(nk.hoVaTen || "") === tenCanTim);
  return khop.length === 1 ? khop[0] : null;
};

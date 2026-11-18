// Báo sang CRM (POST /api/tich-hop/thong-bao-gia-0) khi sửa đơn hàng làm 1 dòng
// sản phẩm từ đơn giá > 0 thành đơn giá = 0 (kể cả đổi loại đơn từ "Mới" sang
// hàng sửa / làm lại / bảo hành). CRM hiện thông báo cho Quản lý
// (chuông thông báo, cùng chỗ với thông báo đơn xin nghỉ).
// Cấu hình bằng CRM_API_URL + CRM_API_KEY (trùng LAB_API_KEY bên CRM).

const SanPham = require("../models/SanPham");
const BangGia = require("../models/BangGia");

const CRM_TIMEOUT_MS = 8000;

const coGiaNhapTay = (dong) => dong?.donGia !== null && dong?.donGia !== undefined;

const loaiDonCuaDong = (dong) => dong?.loaiDon || "Mới";

// Đơn giá của 1 dòng, giống lúc xuất hóa đơn: dòng không phải hàng "Mới" (hàng
// sửa / làm lại / bảo hành) không tính tiền → 0; còn lại theo thứ tự đơn giá
// nhập tay → bảng giá riêng của nha khoa → giá chung.
const donGiaCuaDong = (dong, sanPhamMap, bangGiaMap) => {
    if (loaiDonCuaDong(dong) !== "Mới") return 0;
    if (coGiaNhapTay(dong)) return Number(dong.donGia) || 0;
    const id = String(dong.sanPham);
    if (bangGiaMap[id] !== undefined) return Number(bangGiaMap[id]) || 0;
    return Number(sanPhamMap[id]?.donGiaChung) || 0;
};

const fmtGia = (v) => `${Number(v).toLocaleString("vi-VN")}đ`;

// So từng dòng theo vị trí (giống nhật ký chỉnh sửa). Trả về danh sách
// { tu, den } — mô tả dòng trước/sau khi sửa — cho những dòng giá > 0 → = 0.
const timDongVeGia0 = async (dsCu, dsMoi, nhaKhoaId) => {
    const cu = dsCu || [];
    const moi = dsMoi || [];
    const n = Math.min(cu.length, moi.length);
    if (n === 0) return [];

    const ids = new Set();
    for (let i = 0; i < n; i++) {
        if (cu[i]?.sanPham) ids.add(String(cu[i].sanPham));
        if (moi[i]?.sanPham) ids.add(String(moi[i].sanPham));
    }
    if (ids.size === 0) return [];

    const [sanPhams, bangGias] = await Promise.all([
        SanPham.find({ _id: { $in: [...ids] } }).select("tenSanPham donGiaChung").lean(),
        nhaKhoaId
            ? BangGia.find({ nhaKhoaId, sanPhamId: { $in: [...ids] } }).select("sanPhamId donGia").lean()
            : [],
    ]);
    const sanPhamMap = Object.fromEntries(sanPhams.map((sp) => [String(sp._id), sp]));
    const bangGiaMap = Object.fromEntries(bangGias.map((bg) => [String(bg.sanPhamId), bg.donGia]));

    const moTa = (dong, gia) => {
        const ten = sanPhamMap[String(dong.sanPham)]?.tenSanPham || "(không rõ)";
        const monHang = coGiaNhapTay(dong) && dong.ghiChu?.trim() ? `: ${dong.ghiChu.trim()}` : "";
        const loaiDon = loaiDonCuaDong(dong) !== "Mới" ? ` - ${loaiDonCuaDong(dong)}` : "";
        return `${ten}${monHang}${loaiDon} (${fmtGia(gia)})`;
    };

    const ketQua = [];
    for (let i = 0; i < n; i++) {
        if (!cu[i]?.sanPham || !moi[i]?.sanPham) continue;
        const giaCu = donGiaCuaDong(cu[i], sanPhamMap, bangGiaMap);
        const giaMoi = donGiaCuaDong(moi[i], sanPhamMap, bangGiaMap);
        if (giaCu > 0 && giaMoi === 0) {
            ketQua.push({ tu: moTa(cu[i], giaCu), den: moTa(moi[i], giaMoi) });
        }
    }
    return ketQua;
};

// Trả về kết quả CRM, hoặc null nếu chưa cấu hình CRM.
const guiThongBaoGia0SangCrm = async (payload) => {
    const { CRM_API_URL, CRM_API_KEY } = process.env;
    if (!CRM_API_URL || !CRM_API_KEY) return null;

    const response = await fetch(new URL("/api/tich-hop/thong-bao-gia-0", CRM_API_URL), {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": CRM_API_KEY },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`CRM trả về lỗi ${response.status}`);
    }
    return response.json();
};

module.exports = { timDongVeGia0, guiThongBaoGia0SangCrm };

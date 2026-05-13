const DonHang = require("../models/DonHang");
const BenhNhan = require("../models/BenhNhan");
const NguoiLienHe = require("../models/NguoiLienHe");

const buildOrderCodePrefix = (date = new Date()) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `TAN${yy}${mm}`;
};

const generateMaDonHang = async () => {
    const prefix = buildOrderCodePrefix();
    const regex = new RegExp(`^${prefix}\\d{4}$`);

    const latest = await DonHang.findOne({ maDonHang: { $regex: regex } })
        .sort({ maDonHang: -1 })
        .select("maDonHang")
        .lean();

    let nextSequence = 0;
    if (latest?.maDonHang) {
        const lastSeq = Number(latest.maDonHang.slice(-4));
        if (Number.isFinite(lastSeq)) {
            nextSequence = lastSeq + 1;
        }
    }

    return `${prefix}${String(nextSequence).padStart(4, "0")}`;
};

// [POST] Tạo đơn hàng mới
exports.createDonHang = async (req, res) => {
    try {
        const { nhaKhoa, bacSi, benhNhan } = req.body;

        // Optional: Kiểm tra logic Bác sĩ và Bệnh nhân có thực sự thuộc Nha khoa này không
        const checkBenhNhan = await BenhNhan.findOne({ _id: benhNhan, nhaKhoa: nhaKhoa });
        const checkBacSi = await NguoiLienHe.findOne({ _id: bacSi, nhaKhoa: nhaKhoa });

        if (!checkBenhNhan) {
            return res.status(400).json({ success: false, message: "Bệnh nhân không thuộc Nha khoa này" });
        }
        if (!checkBacSi) {
            return res.status(400).json({ success: false, message: "Bác sĩ không thuộc Nha khoa này" });
        }

        // Sinh mã theo chuẩn: TAN + YY + MM + 4 số tăng dần trong tháng
        let maDonHang = await generateMaDonHang();
        let retry = 0;

        while (retry < 3) {
            try {
                const newDonHang = new DonHang({
                    ...req.body,
                    maDonHang,
                });
                await newDonHang.save();

                return res.status(201).json({
                    success: true,
                    message: "Tạo đơn hàng thành công",
                    data: newDonHang,
                });
            } catch (saveError) {
                if (saveError?.code !== 11000 || !saveError?.keyPattern?.maDonHang) {
                    throw saveError;
                }
                retry += 1;
                maDonHang = await generateMaDonHang();
            }
        }

        return res.status(500).json({
            success: false,
            message: "Không thể sinh mã đơn hàng duy nhất. Vui lòng thử lại.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo đơn hàng",
            error: error.message,
        });
    }
};

// [GET] Lấy danh sách đơn hàng
exports.getAllDonHang = async (req, res) => {
    try {
        const donHangs = await DonHang.find()
            .populate("nhaKhoa", "tenGiaoDich hoVaTen")
            .populate("bacSi", "hoVaTen soDienThoai")
            .populate("benhNhan", "hoVaTen soHoSo")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh")
            .sort({ createdAt: -1 }); // Mới nhất lên đầu

        res.status(200).json({
            success: true,
            count: donHangs.length,
            data: donHangs,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hàng",
            error: error.message,
        });
    }
};

// [GET] Lấy chi tiết 1 đơn hàng
exports.getDonHangById = async (req, res) => {
    try {
        const donHang = await DonHang.findById(req.params.id)
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh")
            .populate("danhSachSanPham.donHangCu");

        if (!donHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        res.status(200).json({ success: true, data: donHang });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [PUT] Cập nhật đơn hàng
exports.updateDonHang = async (req, res) => {
    try {
        const updatedDonHang = await DonHang.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' })
            .populate("nhaKhoa", "hoVaTen tenGiaoDich soDienThoai email diaChiCuThe")
            .populate("bacSi", "hoVaTen soDienThoai email")
            .populate("benhNhan", "hoVaTen soHoSo soDienThoai")
            .populate("danhSachSanPham.sanPham", "tenSanPham donGiaChung loaiTinh")
            .populate("danhSachSanPham.donHangCu");

        if (!updatedDonHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        res.status(200).json({ success: true, data: updatedDonHang });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [DELETE] Xóa đơn hàng
exports.deleteDonHang = async (req, res) => {
    try {
        const deletedDonHang = await DonHang.findByIdAndDelete(req.params.id);
        if (!deletedDonHang) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        }
        res.status(200).json({ success: true, message: "Xóa đơn hàng thành công" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
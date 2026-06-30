const ChiPhi = require('../models/ChiPhi'); // Đường dẫn có thể thay đổi tùy cấu trúc thư mục của bạn
const BangLuong = require('../models/BangLuong'); // Import model Bảng Lương
const PhieuNhapKho = require("../models/PhieuNhapKho");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

// 1. Tạo chi phí mới
exports.taoChiPhi = async (req, res) => {
    try {
        const { tenChiPhi, loaiChiPhi, gia, ghiChu } = req.body;

        // Kiểm tra đầu vào cơ bản
        if (!tenChiPhi || !loaiChiPhi || gia === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ Tên, Loại chi phí và Giá!'
            });
        }

        const chiPhiMoi = new ChiPhi({
            tenChiPhi,
            loaiChiPhi,
            gia,
            ghiChu
        });

        const daLuu = await chiPhiMoi.save();

        res.status(201).json({
            success: true,
            message: 'Tạo chi phí thành công',
            data: daLuu
        });

    } catch (error) {
        console.error('Lỗi khi tạo chi phí:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo chi phí',
            error: error.message
        });
    }
};

// 2. Chỉnh sửa/Cập nhật chi phí
exports.updateChiPhi = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenChiPhi, loaiChiPhi, gia, ghiChu } = req.body;

        const chiPhiCapNhat = await ChiPhi.findByIdAndUpdate(
            id,
            { tenChiPhi, loaiChiPhi, gia, ghiChu },
            { new: true, runValidators: true } // Trả về document mới sau khi update
        );

        if (!chiPhiCapNhat) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi phí cần chỉnh sửa'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật chi phí thành công',
            data: chiPhiCapNhat
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật chi phí:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật chi phí',
            error: error.message
        });
    }
};

// 3. Xóa chi phí (Option: Dành cho trường hợp nhập sai)
exports.xoaChiPhi = async (req, res) => {
    try {
        const { id } = req.params;
        const chiPhiDaXoa = await ChiPhi.findByIdAndDelete(id);

        if (!chiPhiDaXoa) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi phí cần xóa'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Đã xóa chi phí thành công'
        });

    } catch (error) {
        console.error('Lỗi khi xóa chi phí:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa chi phí',
            error: error.message
        });
    }
};

exports.layDanhSachChiPhi = async (req, res) => {
    try {
        // 1. Lấy tháng/năm từ query, mặc định là tháng hiện tại theo giờ VN
        const now = dayjs().tz("Asia/Ho_Chi_Minh");
        const thang = req.query.thang ? parseInt(req.query.thang) : now.month() + 1;
        const nam = req.query.nam ? parseInt(req.query.nam) : now.year();

        // 2. Tính ngày bắt đầu và kết thúc của tháng để lọc trong bảng ChiPhi
        const startDate = dayjs.tz(`${nam}-${thang}-01`, "Asia/Ho_Chi_Minh").startOf("month").toDate();
        const endDate = dayjs.tz(`${nam}-${thang}-01`, "Asia/Ho_Chi_Minh").endOf("month").toDate();

        // Lấy các chi phí THỦ CÔNG tạo trong tháng
        const chiPhiThuCong = await ChiPhi.find({
            ngayTao: { $gte: startDate, $lte: endDate }
        }).sort({ ngayTao: -1 }).lean();

        // 3. Tổng hợp LƯƠNG NHÂN VIÊN từ bảng BangLuong
        // CẬP NHẬT: Thêm populate để lấy dữ liệu họ tên nhân viên (nếu reference)
        const bangLuongList = await BangLuong.find({ thang, nam }).populate('nhanVien').lean();

        const tongLuongThucNhan = bangLuongList.reduce(
            (sum, item) => sum + (item.thucNhan || 0) + (item.ungTruoc || 0), 0
        );

        const chiPhiLuong = {
            _id: "auto_luong_nhan_vien",
            tenChiPhi: `Tổng lương nhân viên tháng ${thang}/${nam}`,
            loaiChiPhi: "Lương NV",
            gia: tongLuongThucNhan,
            ghiChu: "Lấy từ Bảng lương",
            ngayTao: startDate,
            isAuto: true,
            chiTiet: bangLuongList // <-- CẬP NHẬT: Đính kèm danh sách chi tiết
        };

        // 4. Tính CHI PHÍ VẬT LIỆU TỰ ĐỘNG TỪ KHO
        const thongKeVatLieu = await PhieuNhapKho.aggregate([
            { $match: { trangThai: "Đã nhận", ngayTao: { $gte: startDate, $lte: endDate } } },
            { $unwind: "$danhSachVatLieu" },
            { $group: { _id: null, tongChiPhi: { $sum: "$danhSachVatLieu.thanhTien" } } }
        ]);

        const tongGiaVatLieu = thongKeVatLieu.length > 0 ? thongKeVatLieu[0].tongChiPhi : 0;

        const chiPhiVatLieu = {
            _id: "auto_chi_phi_vat_lieu",
            tenChiPhi: `Chi phí vật liệu tháng ${thang}/${nam}`,
            loaiChiPhi: "Vật tư",
            gia: tongGiaVatLieu,
            ghiChu: "Lấy từ Phiếu nhập kho",
            ngayTao: startDate,
            isAuto: true
        };

        // 5. Gộp danh sách và làm tròn tất cả giá về đơn vị nghìn
        const danhSachChiPhi = [
            chiPhiVatLieu,
            chiPhiLuong,
            ...chiPhiThuCong
        ].map(item => ({
            ...item,
            gia: Math.round((item.gia || 0) / 1000) * 1000
        }));

        res.status(200).json({ success: true, data: danhSachChiPhi });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách chi phí:", error);
        res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách chi phí", error: error.message });
    }
};

exports.thongKeChiPhiNhapTheoThang = async (req, res) => {
    try {
        const { tuNgay, denNgay } = req.query;

        // 1. Tạo bộ lọc cơ bản: Chỉ tính các phiếu "Đã nhận"
        const matchStage = {
            trangThai: "Đã nhận"
        };

        // 2. Lọc theo khoảng thời gian sử dụng dayjs timezone
        if (tuNgay || denNgay) {
            matchStage.ngayTao = {};

            if (tuNgay) {
                // Đưa về 00:00:00.000 của ngày tuNgay theo giờ VN, sau đó convert sang chuẩn Date để query DB
                matchStage.ngayTao.$gte = dayjs.tz(tuNgay).startOf('day').toDate();
            }
            if (denNgay) {
                // Đưa về 23:59:59.999 của ngày denNgay theo giờ VN
                matchStage.ngayTao.$lte = dayjs.tz(denNgay).endOf('day').toDate();
            }
        }

        // 3. Thực thi Aggregation Pipeline
        const result = await PhieuNhapKho.aggregate([
            {
                $match: matchStage
            },
            {
                $unwind: "$danhSachVatLieu" // Tách mảng danhSachVatLieu để dễ tính tổng
            },
            {
                $group: {
                    _id: null,
                    tongChiPhi: { $sum: "$danhSachVatLieu.thanhTien" } // Cộng dồn trường thanhTien
                }
            }
        ]);

        const tongChiPhi = result.length > 0 ? result[0].tongChiPhi : 0;

        res.status(200).json({
            success: true,
            data: {
                tuNgay,
                denNgay,
                tongChiPhi
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi thống kê chi phí vật liệu",
            error: error.message,
        });
    }
};
// Lấy danh sách loại chi phí động bằng distinct
exports.layDanhSachLoaiChiPhi = async (req, res) => {
    try {
        // Quét toàn bộ bảng ChiPhi, lấy ra các giá trị loaiChiPhi không trùng lặp
        const danhSachTuDB = await ChiPhi.distinct("loaiChiPhi");

        // Các loại mặc định
        const loaiMacDinh = ["Điện nước", "Vật tư", "Sửa chữa", "Khác"];

        // Gộp mảng và dùng Set để loại bỏ trùng lặp
        let danhSachCuoiCung = [...new Set([...loaiMacDinh, ...danhSachTuDB])];

        // Sắp xếp: A-Z, nhưng "Khác" luôn nằm cuối cùng
        danhSachCuoiCung.sort((a, b) => {
            if (a === "Khác") return 1; // a là "Khác" thì đẩy a xuống dưới b
            if (b === "Khác") return -1; // b là "Khác" thì đẩy b xuống dưới a
            return a.localeCompare(b); // Còn lại so sánh alphabet bình thường
        });

        res.status(200).json({ success: true, data: danhSachCuoiCung });
    } catch (error) {
        console.error('Lỗi khi lấy loại chi phí:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};
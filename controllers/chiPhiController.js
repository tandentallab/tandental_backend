const ChiPhi = require('../models/ChiPhi'); //[cite: 2]
const BangLuong = require('../models/BangLuong'); //[cite: 2]
const PhieuNhapKho = require("../models/PhieuNhapKho"); //[cite: 2]
const dayjs = require('dayjs'); //[cite: 2]
const utc = require('dayjs/plugin/utc'); //[cite: 2]
const timezone = require('dayjs/plugin/timezone'); //[cite: 2]

dayjs.extend(utc); //[cite: 2]
dayjs.extend(timezone); //[cite: 2]
dayjs.tz.setDefault("Asia/Ho_Chi_Minh"); //[cite: 2]

// ================= 1. API QUỸ CHI PHÍ (TÍNH TOÁN ĐỘNG) =================

// Thao tác nộp tiền vào quỹ
exports.napQuy = async (req, res) => {
    try {
        const { soTien } = req.body;
        if (!soTien || soTien <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền nạp phải lớn hơn 0' });
        }

        // Tạo một bản ghi ChiPhi đặc biệt với loaiChiPhi là "Nạp quỹ"
        const giaoDichNap = new ChiPhi({
            tenChiPhi: "Nạp tiền quỹ chi phí",
            loaiChiPhi: "Nạp quỹ",
            gia: Number(soTien),

        });

        await giaoDichNap.save();

        // Tính lại số dư hiện tại sau khi nạp để trả về ngay cho FE
        const thongKeQuy = await layThongTinQuyInternal();

        res.status(200).json({
            success: true,
            message: 'Nạp quỹ thành công',
            data: thongKeQuy
        });
    } catch (error) {
        console.error('Lỗi nạp quỹ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi nạp quỹ', error: error.message });
    }
};

// Lấy thông tin số dư quỹ và lần nạp cuối cùng
exports.layThongTinQuy = async (req, res) => {
    try {
        const thongKeQuy = await layThongTinQuyInternal();
        res.status(200).json({
            success: true,
            data: thongKeQuy
        });
    } catch (error) {
        console.error('Lỗi lấy thông tin quỹ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông tin quỹ', error: error.message });
    }
};

// Hàm helper nội bộ để tính toán số dư quỹ và tìm lần nạp cuối
async function layThongTinQuyInternal() {
    // 1. Tìm giao dịch "Nạp quỹ" ĐẦU TIÊN để làm mốc thời gian bắt đầu
    // sort({ ngayTao: 1 }) để lấy record cũ nhất
    const lanNapDauTien = await ChiPhi.findOne({ loaiChiPhi: "Nạp quỹ" }).sort({ ngayTao: 1 });

    let tongNap = 0;
    let tongChi = 0;
    let lanNapCuoi = null;

    // Nếu đã từng nạp quỹ ít nhất 1 lần thì mới bắt đầu tính toán
    if (lanNapDauTien) {
        const mocThoiGian = lanNapDauTien.ngayTao;

        // Tính tổng số tiền ĐÃ NẠP vào quỹ
        const tongNapResult = await ChiPhi.aggregate([
            { $match: { loaiChiPhi: "Nạp quỹ" } },
            { $group: { _id: null, tong: { $sum: "$gia" } } }
        ]);
        tongNap = tongNapResult.length > 0 ? tongNapResult[0].tong : 0;

        // Tính tổng số tiền ĐÃ CHI (CHỈ TÍNH TỪ LÚC NẠP QUỸ LẦN ĐẦU TIÊN)
        const tongChiResult = await ChiPhi.aggregate([
            {
                $match: {
                    loaiChiPhi: { $ne: "Nạp quỹ" },
                    ngayTao: { $gte: mocThoiGian } // <-- CHÌA KHÓA: Chỉ lấy chi phí sinh ra sau hoặc bằng mốc này
                }
            },
            { $group: { _id: null, tong: { $sum: "$gia" } } }
        ]);
        tongChi = tongChiResult.length > 0 ? tongChiResult[0].tong : 0;

        // Tìm giao dịch nạp cuối cùng
        lanNapCuoi = await ChiPhi.findOne({ loaiChiPhi: "Nạp quỹ" }).sort({ ngayTao: -1 });
    }

    // Tồn quỹ thực tế
    const tonQuy = tongNap - tongChi;

    return {
        soDu: tonQuy,             // Trả về số dư thực tế
        tongNap: tongNap,         // Trả về tổng đã nạp
        lanNapCuoi: lanNapCuoi ? lanNapCuoi.ngayTao : null,
        soTienNapCuoi: lanNapCuoi ? lanNapCuoi.gia : 0,
        idNapCuoi: lanNapCuoi ? lanNapCuoi._id : null
    };
}


// ================= 2. CÁC API CHI PHÍ CŨ (KHÔNG ĐỔI HOẶC CHỈ CHỈNH SỬA NHỎ) =================

// Tạo chi phí mới
exports.taoChiPhi = async (req, res) => {
    try {
        const { tenChiPhi, loaiChiPhi, gia, ghiChu } = req.body; //[cite: 2]

        if (!tenChiPhi || !loaiChiPhi || gia === undefined) { //[cite: 2]
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ Tên, Loại chi phí và Giá!' //[cite: 2]
            });
        }

        const chiPhiMoi = new ChiPhi({ //[cite: 2]
            tenChiPhi, //[cite: 2]
            loaiChiPhi, //[cite: 2]
            gia, //[cite: 2]
            ghiChu //[cite: 2]
        }); //[cite: 2]

        const daLuu = await chiPhiMoi.save(); //[cite: 2]

        res.status(201).json({
            success: true,
            message: 'Tạo chi phí thành công', //[cite: 2]
            data: daLuu //[cite: 2]
        });

    } catch (error) {
        console.error('Lỗi khi tạo chi phí:', error); //[cite: 2]
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo chi phí', //[cite: 2]
            error: error.message //[cite: 2]
        });
    }
};

// Chỉnh sửa/Cập nhật chi phí
exports.updateChiPhi = async (req, res) => {
    try {
        const { id } = req.params; //[cite: 2]
        const { tenChiPhi, loaiChiPhi, gia, ghiChu } = req.body; //[cite: 2]

        const chiPhiCapNhat = await ChiPhi.findByIdAndUpdate(
            id,
            { tenChiPhi, loaiChiPhi, gia, ghiChu },
            { new: true, runValidators: true } //[cite: 2]
        );

        if (!chiPhiCapNhat) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi phí cần chỉnh sửa' //[cite: 2]
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật chi phí thành công', //[cite: 2]
            data: chiPhiCapNhat //[cite: 2]
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật chi phí:', error); //[cite: 2]
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật chi phí', //[cite: 2]
            error: error.message //[cite: 2]
        });
    }
};

// Xóa chi phí
exports.xoaChiPhi = async (req, res) => {
    try {
        const { id } = req.params; //[cite: 2]
        const chiPhiDaXoa = await ChiPhi.findByIdAndDelete(id); //[cite: 2]

        if (!chiPhiDaXoa) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi phí cần xóa' //[cite: 2]
            });
        }

        res.status(200).json({
            success: true,
            message: 'Đã xóa chi phí thành công' //[cite: 2]
        });

    } catch (error) {
        console.error('Lỗi khi xóa chi phí:', error); //[cite: 2]
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa chi phí', //[cite: 2]
            error: error.message //[cite: 2]
        });
    }
};

// Lấy danh sách chi phí (Lưu ý: Loại bỏ phần "Nạp quỹ" ra khỏi bảng chi phí thông thường để tránh lẫn lộn)
exports.layDanhSachChiPhi = async (req, res) => {
    try {
        const now = dayjs().tz("Asia/Ho_Chi_Minh"); //[cite: 2]
        const thang = req.query.thang ? parseInt(req.query.thang) : now.month() + 1; //[cite: 2]
        const nam = req.query.nam ? parseInt(req.query.nam) : now.year(); //[cite: 2]

        const startDate = dayjs.tz(`${nam}-${thang}-01`, "Asia/Ho_Chi_Minh").startOf("month").toDate(); //[cite: 2]
        const endDate = dayjs.tz(`${nam}-${thang}-01`, "Asia/Ho_Chi_Minh").endOf("month").toDate(); //[cite: 2]

        // Chỉ lấy các chi phí THỦ CÔNG tạo trong tháng và KHÔNG PHẢI LÀ giao dịch "Nạp quỹ"
        const chiPhiThuCong = await ChiPhi.find({
            loaiChiPhi: { $ne: "Nạp quỹ" }, // Thêm lọc loại trừ Nạp quỹ ở đây
            ngayTao: { $gte: startDate, $lte: endDate } //[cite: 2]
        }).sort({ ngayTao: -1 }).lean(); //[cite: 2]

        // Tổng hợp LƯƠNG NHÂN VIÊN từ bảng BangLuong
        const bangLuongList = await BangLuong.find({ thang, nam }).populate('nhanVien').lean(); //[cite: 2]
        const tongLuongThucNhan = bangLuongList.reduce(
            (sum, item) => sum + (item.thucNhan || 0) + (item.ungTruoc || 0), 0 //[cite: 2]
        );

        const chiPhiLuong = {
            _id: "auto_luong_nhan_vien",
            tenChiPhi: `Tổng lương nhân viên tháng ${thang}/${nam}`, //[cite: 2]
            loaiChiPhi: "Lương NV", //[cite: 2]
            gia: tongLuongThucNhan, //[cite: 2]
            ghiChu: "Lấy từ Bảng lương", //[cite: 2]
            ngayTao: startDate, //[cite: 2]
            isAuto: true, //[cite: 2]
            chiTiet: bangLuongList //[cite: 2]
        };

        // Tính CHI PHÍ VẬT LIỆU TỰ ĐỘNG TỪ KHO
        const thongKeVatLieu = await PhieuNhapKho.aggregate([
            { $match: { trangThai: "Đã nhận", ngayTao: { $gte: startDate, $lte: endDate } } }, //[cite: 2]
            { $unwind: "$danhSachVatLieu" }, //[cite: 2]
            { $group: { _id: null, tongChiPhi: { $sum: "$danhSachVatLieu.thanhTien" } } } //[cite: 2]
        ]);

        const tongGiaVatLieu = thongKeVatLieu.length > 0 ? thongKeVatLieu[0].tongChiPhi : 0; //[cite: 2]

        const chiPhiVatLieu = {
            _id: "auto_chi_phi_vat_lieu",
            tenChiPhi: `Chi phí vật liệu tháng ${thang}/${nam}`, //[cite: 2]
            loaiChiPhi: "Vật tư", //[cite: 2]
            gia: tongGiaVatLieu, //[cite: 2]
            ghiChu: "Lấy từ Phiếu nhập kho", //[cite: 2]
            ngayTao: startDate, //[cite: 2]
            isAuto: true //[cite: 2]
        };

        const danhSachChiPhi = [
            chiPhiVatLieu, //[cite: 2]
            chiPhiLuong, //[cite: 2]
            ...chiPhiThuCong //[cite: 2]
        ].map(item => ({
            ...item,
            gia: Math.round((item.gia || 0) / 1000) * 1000 //[cite: 2]
        }));

        res.status(200).json({ success: true, data: danhSachChiPhi }); //[cite: 2]

    } catch (error) {
        console.error("Lỗi khi lấy danh sách chi phí:", error); //[cite: 2]
        res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách chi phí", error: error.message }); //[cite: 2]
    }
};

// Thống kê chi phí nhập theo tháng
exports.thongKeChiPhiNhapTheoThang = async (req, res) => {
    try {
        const { tuNgay, denNgay } = req.query; //[cite: 2]
        const matchStage = { trangThai: "Đã nhận" }; //[cite: 2]

        if (tuNgay || denNgay) {
            matchStage.ngayTao = {}; //[cite: 2]
            if (tuNgay) matchStage.ngayTao.$gte = dayjs.tz(tuNgay).startOf('day').toDate(); //[cite: 2]
            if (denNgay) matchStage.ngayTao.$lte = dayjs.tz(denNgay).endOf('day').toDate(); //[cite: 2]
        }

        const result = await PhieuNhapKho.aggregate([
            { $match: matchStage }, //[cite: 2]
            { $unwind: "$danhSachVatLieu" }, //[cite: 2]
            { $group: { _id: null, tongChiPhi: { $sum: "$danhSachVatLieu.thanhTien" } } } //[cite: 2]
        ]);

        const tongChiPhi = result.length > 0 ? result[0].tongChiPhi : 0; //[cite: 2]

        res.status(200).json({
            success: true,
            data: { tuNgay, denNgay, tongChiPhi } //[cite: 2]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi khi thống kê chi phí vật liệu", error: error.message }); //[cite: 2]
    }
};

// Lấy danh sách loại chi phí động (Loại bỏ "Nạp quỹ" để nhân viên không chọn nhầm khi tạo tay)
exports.layDanhSachLoaiChiPhi = async (req, res) => {
    try {
        const danhSachTuDB = await ChiPhi.distinct("loaiChiPhi", { loaiChiPhi: { $ne: "Nạp quỹ" } }); // Loại bỏ "Nạp quỹ"

        const loaiMacDinh = ["Điện nước", "Vật tư", "Sửa chữa", "Khác"]; //[cite: 2]
        let danhSachCuoiCung = [...new Set([...loaiMacDinh, ...danhSachTuDB])]; //[cite: 2]

        danhSachCuoiCung.sort((a, b) => {
            if (a === "Khác") return 1; //[cite: 2]
            if (b === "Khác") return -1; //[cite: 2]
            return a.localeCompare(b); //[cite: 2]
        });

        res.status(200).json({ success: true, data: danhSachCuoiCung }); //[cite: 2]
    } catch (error) {
        console.error('Lỗi khi lấy loại chi phí:', error); //[cite: 2]
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message }); //[cite: 2]
    }
};

// =========================================================================
// MỚI: 1. API Lấy lịch sử nạp quỹ (Sắp xếp mới nhất lên đầu)
// =========================================================================
exports.lichSuNapQuy = async (req, res) => {
    try {
        const lichSu = await ChiPhi.find({ loaiChiPhi: "Nạp quỹ" })
            .sort({ ngayTao: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: lichSu
        });
    } catch (error) {
        console.error('Lỗi lấy lịch sử nạp quỹ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử', error: error.message });
    }
};

// =========================================================================
// MỚI: 2. API Tính toán Tồn quỹ theo một ngày cụ thể (Dành cho Phiếu In)
// =========================================================================
exports.tinhTonQuyTheoNgay = async (req, res) => {
    try {
        const { ngay } = req.query; // Format mong đợi: YYYY-MM-DD

        if (!ngay) {
            return res.status(400).json({ success: false, message: "Vui lòng truyền tham số ngày (YYYY-MM-DD)." });
        }

        const targetDate = dayjs.tz(ngay, "Asia/Ho_Chi_Minh");
        const startOfDay = targetDate.startOf('day').toDate();
        const endOfDay = targetDate.endOf('day').toDate();

        // 1. Tìm lần nạp đầu tiên làm mốc
        const lanNapDauTien = await ChiPhi.findOne({ loaiChiPhi: "Nạp quỹ" }).sort({ ngayTao: 1 });

        let tonDauNgay = 0;
        let phatSinhNapTrongNgay = 0;
        let phatSinhChiTrongNgay = 0;

        if (lanNapDauTien && startOfDay >= lanNapDauTien.ngayTao) {
            // Tổng nạp TRƯỚC 00:00:00 ngày đang xét
            const tongNapTruoc = await ChiPhi.aggregate([
                { $match: { loaiChiPhi: "Nạp quỹ", ngayTao: { $lt: startOfDay } } },
                { $group: { _id: null, tong: { $sum: "$gia" } } }
            ]);
            const napTruoc = tongNapTruoc.length > 0 ? tongNapTruoc[0].tong : 0;

            // Tổng chi TRƯỚC 00:00:00 ngày đang xét (chỉ tính từ lúc bắt đầu có quỹ)
            const tongChiTruoc = await ChiPhi.aggregate([
                { $match: { loaiChiPhi: { $ne: "Nạp quỹ" }, ngayTao: { $gte: lanNapDauTien.ngayTao, $lt: startOfDay } } },
                { $group: { _id: null, tong: { $sum: "$gia" } } }
            ]);
            const chiTruoc = tongChiTruoc.length > 0 ? tongChiTruoc[0].tong : 0;

            tonDauNgay = napTruoc - chiTruoc;
        }

        // 2. Tính Phát sinh NẠP trong chính ngày đó (từ 00:00:00 đến 23:59:59)
        const tongNapTrongNgay = await ChiPhi.aggregate([
            { $match: { loaiChiPhi: "Nạp quỹ", ngayTao: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, tong: { $sum: "$gia" } } }
        ]);
        phatSinhNapTrongNgay = tongNapTrongNgay.length > 0 ? tongNapTrongNgay[0].tong : 0;

        // 3. Tính Phát sinh CHI trong chính ngày đó (từ 00:00:00 đến 23:59:59)
        const tongChiTrongNgay = await ChiPhi.aggregate([
            { $match: { loaiChiPhi: { $ne: "Nạp quỹ" }, ngayTao: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, tong: { $sum: "$gia" } } }
        ]);
        phatSinhChiTrongNgay = tongChiTrongNgay.length > 0 ? tongChiTrongNgay[0].tong : 0;

        // 4. Tính Tồn cuối ngày = Tồn đầu + Nạp thêm trong ngày - Chi trong ngày
        const tonCuoiNgay = tonDauNgay + phatSinhNapTrongNgay - phatSinhChiTrongNgay;

        res.status(200).json({
            success: true,
            data: {
                ngay: targetDate.format('DD/MM/YYYY'),
                tonDauNgay,
                phatSinhNapTrongNgay,
                phatSinhChiTrongNgay,
                tonCuoiNgay
            }
        });

    } catch (error) {
        console.error('Lỗi tính tồn quỹ theo ngày:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tính tồn quỹ theo ngày', error: error.message });
    }
};
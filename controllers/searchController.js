const NhaKhoa = require('../models/NhaKhoa');
const BenhNhan = require('../models/BenhNhan');
const DonHang = require('../models/DonHang');

exports.globalSearch = async (req, res) => {
    try {
        const { q, types } = req.query;

        if (!q || q.trim() === '') {
            return res.status(200).json({
                success: true,
                data: { nhaKhoa: [], benhNhan: [], donHang: [] }
            });
        }

        const searchTypes = types ? types.split(',') : ['nhakhoa', 'benhnhan', 'donhang'];
        const keyword = q.trim();

        let results = { nhaKhoa: [], benhNhan: [], donHang: [] };
        const promises = [];

        // 1. Tìm Nha Khoa (Tìm theo hoVaTen hoặc tenGiaoDich)
        if (searchTypes.includes('nhakhoa')) {
            promises.push(
                NhaKhoa.find({
                    $or: [
                        { hoVaTen: { $regex: keyword, $options: 'i' } },
                        { tenGiaoDich: { $regex: keyword, $options: 'i' } }
                    ]
                })
                    .select('hoVaTen tenGiaoDich soDienThoai')
                    .limit(5).lean()
                    .then(data => results.nhaKhoa = data)
            );
        }

        // 2. Tìm Bệnh Nhân (Tìm theo hoVaTen hoặc soHoSo)
        if (searchTypes.includes('benhnhan')) {
            promises.push(
                BenhNhan.find({
                    $or: [
                        { hoVaTen: { $regex: keyword, $options: 'i' } },
                        { soHoSo: { $regex: keyword, $options: 'i' } }
                    ]
                })
                    .select('hoVaTen soHoSo namSinh gioiTinh')
                    .limit(5).lean()
                    .then(data => results.benhNhan = data)
            );
        }

        // 3. Tìm Đơn Hàng (Tìm theo Mã đơn, hoặc có chứa ID Nha Khoa/Bệnh nhân khớp tên)
        if (searchTypes.includes('donhang')) {
            promises.push(
                (async () => {
                    // Lấy danh sách ID Nha Khoa khớp với từ khóa
                    const matchedNhaKhoas = await NhaKhoa.find({
                        $or: [
                            { hoVaTen: { $regex: keyword, $options: 'i' } },
                            { tenGiaoDich: { $regex: keyword, $options: 'i' } }
                        ]
                    }).select('_id').lean();

                    // Lấy danh sách ID Bệnh Nhân khớp với từ khóa
                    const matchedBenhNhans = await BenhNhan.find({
                        $or: [
                            { hoVaTen: { $regex: keyword, $options: 'i' } },
                            { soHoSo: { $regex: keyword, $options: 'i' } }
                        ]
                    }).select('_id').lean();

                    const nkIds = matchedNhaKhoas.map(nk => nk._id);
                    const bnIds = matchedBenhNhans.map(bn => bn._id);

                    // Truy vấn Đơn Hàng tổng hợp
                    const donHangData = await DonHang.find({
                        $or: [
                            { maDonHang: { $regex: keyword, $options: 'i' } },
                            { nhaKhoa: { $in: nkIds } },
                            { benhNhan: { $in: bnIds } }
                        ]
                    })
                        .populate('nhaKhoa', 'hoVaTen tenGiaoDich') // Đổ dữ liệu chuẩn để Frontend dùng
                        .populate('benhNhan', 'hoVaTen soHoSo')
                        .select('maDonHang nhaKhoa benhNhan trangThai')
                        .limit(5).lean();

                    results.donHang = donHangData;
                })()
            );
        }

        await Promise.all(promises);

        res.status(200).json({ success: true, data: results });

    } catch (error) {
        console.error("Lỗi tìm kiếm toàn cục:", error);
        res.status(500).json({ success: false, message: "Lỗi server khi tìm kiếm" });
    }
};
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const BangGia = require("../models/bangGia");
const SanPham = require("../models/sanPham");

//Lấy danh sách đơn hàng chưa xuất hóa đơn
exports.getDonHangChuaXuatHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;

    const donHangs = await DonHang.find({
      nhaKhoa: nhaKhoaId,
      daXuatHoaDon: { $ne: true },
    })
      .populate("bacSi", "hoVaTen")
      .sort({ createdAt: -1 });

    res.json(donHangs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//Lấy đơn giá cho từng sản phẩm
async function getDonGia(nhaKhoaId, sanPhamId) {
  const giaRieng = await BangGia.findOne({ nhaKhoaId, sanPhamId });

  if (giaRieng) return giaRieng.donGia;

  const sp = await SanPham.findById(sanPhamId);
  return sp.donGiaChung;
}
async function tinhTienDonHang(donHang, nhaKhoaId) {
  let tong = 0;

  for (const item of donHang.danhSachSanPham) {
    const donGia = await getDonGia(nhaKhoaId, item.sanPham);

    tong += donGia * item.soLuong;
  }

  return tong;
}

/* ================= TẠO HÓA ĐƠN ================= */
exports.createHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId, danhSachDonHang } = req.body;

    let tongTien = 0;
    let tongChietKhau = 0;

    const resultDonHang = [];

    for (const item of danhSachDonHang) {
      const donHang = await DonHang.findById(item.donHangId);

      if (!donHang) continue;

      // 🔥 tính tiền theo bảng giá
      const tongTienDon = await tinhTienDonHang(donHang, nhaKhoaId);

      let chietKhau = item.chietKhau || 0;
      let thanhTienSauCK = tongTienDon;

      if (item.loaiChietKhau === "phanTram") {
        thanhTienSauCK = tongTienDon * (1 - chietKhau / 100);
      } else {
        thanhTienSauCK = tongTienDon - chietKhau;
      }

      tongTien += tongTienDon;
      tongChietKhau += tongTienDon - thanhTienSauCK;

      resultDonHang.push({
        donHang: donHang._id,
        tongTien: tongTienDon,
        chietKhau,
        loaiChietKhau: item.loaiChietKhau,
        thanhTienSauCK,
      });
    }

    const thanhTien = tongTien - tongChietKhau;

    // 🔢 Tạo số hóa đơn
    const count = await HoaDon.countDocuments();

    // ✅ NEW
    const daThanhToan = 0;
    const conLai = thanhTien;

    const hoaDon = new HoaDon({
      nhaKhoa: nhaKhoaId,
      danhSachDonHang: resultDonHang,
      tongTien,
      tongChietKhau,
      thanhTien,
      daThanhToan,
      conLai
    });

    await hoaDon.save();

    // 🔥 cập nhật trạng thái đơn hàng
    await DonHang.updateMany(
      { _id: { $in: danhSachDonHang.map((i) => i.donHangId) } },
      { $set: { daXuatHoaDon: true } }
    );

    res.json({ success: true, data: hoaDon });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Lấy danh sách hóa đơn của tất cả nha khoa (Dành cho Admin)
exports.getAllHoaDonAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { trangThai, search, nhaKhoaId } = req.query;

    let query = {};

    // ✅ Lọc theo trạng thái
    if (trangThai) {
      query.trangThai = trangThai;
    }

    // ✅ Lọc theo nha khoa
    if (nhaKhoaId) {
      query.nhaKhoa = nhaKhoaId;
    }

    // ✅ Search theo số hóa đơn hoặc _id
    if (search) {
      query.$or = [
        {
          soHoaDon: { $regex: search, $options: "i" },
        },
        ...(search.match(/^[0-9a-fA-F]{24}$/)
          ? [{ _id: search }]
          : []),
      ];
    }

    const total = await HoaDon.countDocuments(query);

    const danhSach = await HoaDon.find(query)
      .populate("nhaKhoa", "hoVaTen tinh")
      .populate({
        path: "danhSachDonHang.donHang",
        select: "_id",
        populate: {
          path: "danhSachSanPham.sanPham",
          select: "tenSanPham",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      results: danhSach.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: danhSach,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách hóa đơn theo nha khoa
exports.getAllHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;
    const { search, trangThai } = req.query;

    let query = { nhaKhoa: nhaKhoaId };

    // Lọc theo trạng thái nếu có (Đã thanh toán / Chưa thanh toán)
    if (trangThai) {
      query.trangThai = trangThai;
    }

    // Tìm kiếm theo số hóa đơn nếu có
   

    const danhSachHoaDon = await HoaDon.find(query)
      .populate("nhaKhoa", "tenNhaKhoa")
      .populate({
        path: "danhSachDonHang.donHang",
        populate: { path: "nguoiLienHe", select: "hoVaTen" }
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: danhSachHoaDon.length,
      data: danhSachHoaDon
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật hóa đơn (Ví dụ: Cập nhật trạng thái thanh toán)
exports.updateHoaDon = async (req, res) => {
  try {
    const { id } = req.params;
    const { trangThai, danhSachDonHang } = req.body;

    let hoaDon = await HoaDon.findById(id);
    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    // ✅ UPDATE TRẠNG THÁI
    if (trangThai) {
      hoaDon.trangThai = trangThai;
    }

    /* ================= 🔥 THÊM PHẦN NÀY ================= */
    if (danhSachDonHang) {
      // 👉 Lấy danh sách cũ
      const oldIds = hoaDon.danhSachDonHang.map((i) =>
        i.donHang.toString()
      );

      // 👉 Danh sách mới
      const newIds = danhSachDonHang.map((i) =>
        i.donHang.toString()
      );

      // 🔥 Tìm đơn bị XÓA
      const removedIds = oldIds.filter((id) => !newIds.includes(id));

      // 🔥 Update lại trạng thái đơn hàng bị remove
      if (removedIds.length > 0) {
        await DonHang.updateMany(
          { _id: { $in: removedIds } },
          { $set: { daXuatHoaDon: false } }
        );
      }

      /* ================================================ */

      // ✅ GÁN DANH SÁCH MỚI
      hoaDon.danhSachDonHang = danhSachDonHang;

      // ✅ TÍNH LẠI TIỀN
      let moiTongTien = 0;
      let moiTongChietKhau = 0;

      hoaDon.danhSachDonHang.forEach((item) => {
        moiTongTien += item.tongTien || 0;
        moiTongChietKhau +=
          (item.tongTien || 0) - (item.thanhTienSauCK || 0);
      });

      hoaDon.tongTien = moiTongTien;
      hoaDon.tongChietKhau = moiTongChietKhau;
      hoaDon.thanhTien = moiTongTien - moiTongChietKhau;
    }

    const updatedHoaDon = await hoaDon.save();

    res.json({
      success: true,
      message: "Cập nhật hóa đơn thành công",
      data: updatedHoaDon,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Thanh toán hóa đơn (có thể thanh toán nhiều lần)
exports.thanhToanHoaDon = async (req, res) => {
  try {
    const { id } = req.params;
    const { soTienThanhToan } = req.body;

    if (!soTienThanhToan || soTienThanhToan <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
    }

    const hoaDon = await HoaDon.findById(id);

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    // ❌ Không cho trả dư quá nhiều
    if (soTienThanhToan > hoaDon.conLai) {
      return res.status(400).json({
        success: false,
        message: "Số tiền vượt quá số tiền còn lại",
      });
    }

    // ✅ Cập nhật tiền
    hoaDon.daThanhToan += soTienThanhToan;
    hoaDon.conLai = hoaDon.thanhTien - hoaDon.daThanhToan;

    // ✅ Update trạng thái
    if (hoaDon.conLai === 0) {
      hoaDon.trangThai = "Đã thanh toán";
    } else {
      hoaDon.trangThai = "Thanh toán một phần";
    }

    await hoaDon.save();

    res.json({
      success: true,
      message: "Thanh toán thành công",
      data: hoaDon,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa hóa đơn
exports.deleteHoaDon = async (req, res) => {
  try {
    const { id } = req.params;

    const hoaDon = await HoaDon.findById(id);

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    const trangThai = hoaDon.trangThai;

    // ❌ Không cho xóa nếu thanh toán một phần
    if (trangThai === "Thanh toán một phần") {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa hóa đơn đã thanh toán một phần",
      });
    }

    // 🔥 Nếu CHƯA THANH TOÁN → rollback đơn hàng
    if (trangThai === "Chưa thanh toán") {
      const donHangIds = hoaDon.danhSachDonHang.map((item) =>
        item.donHang.toString()
      );

      if (donHangIds.length > 0) {
        await DonHang.updateMany(
          { _id: { $in: donHangIds } },
          { $set: { daXuatHoaDon: false } }
        );
      }
    }

    // 🔥 Nếu ĐÃ THANH TOÁN → KHÔNG rollback

    // ✅ Xóa hóa đơn
    await HoaDon.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Xóa hóa đơn thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
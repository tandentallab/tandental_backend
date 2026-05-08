const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const BangGia = require("../models/bangGia");
const SanPham = require("../models/SanPham");

// ================= LẤY DANH SÁCH ĐƠN HÀNG CHƯA XUẤT HÓA ĐƠN =================
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

// ================= LẤY ĐƠN GIÁ =================
async function getDonGia(nhaKhoaId, sanPhamId) {
  const giaRieng = await BangGia.findOne({
    nhaKhoaId,
    sanPhamId,
  });

  if (giaRieng) return giaRieng.donGia;

  const sp = await SanPham.findById(sanPhamId);

  return sp?.donGiaChung || 0;
}

// ================= TÍNH TIỀN ĐƠN HÀNG =================
async function tinhTienDonHang(donHang, nhaKhoaId) {
  let tong = 0;

  for (const item of donHang.danhSachSanPham) {
    const donGia = await getDonGia(
      nhaKhoaId,
      item.sanPham
    );

    tong += donGia * item.soLuong;
  }

  return tong;
}

/* ================= TẠO HÓA ĐƠN ================= */
exports.createHoaDon = async (req, res) => {
  try {
    const {
      nhaKhoaId,
      danhSachDonHang,

      thue = 0,
      chiPhiKhac = 0,

      ghiChuNoiBo = "",
      ghiChuChoKhachHang = "",

      chinhSachThanhToan = "Thanh toán cuối tháng",
    } = req.body;

    let tongTien = 0;
    let tongChietKhau = 0;

    const resultDonHang = [];

    for (const item of danhSachDonHang) {
      const donHang = await DonHang.findById(
        item.donHangId
      );

      if (!donHang) continue;

      // 🔥 Tính tiền theo bảng giá
      const tongTienDon = await tinhTienDonHang(
        donHang,
        nhaKhoaId
      );

      let chietKhau = item.chietKhau || 0;

      let thanhTienSauCK = tongTienDon;

      if (item.loaiChietKhau === "phanTram") {
        thanhTienSauCK =
          tongTienDon * (1 - chietKhau / 100);
      } else {
        thanhTienSauCK =
          tongTienDon - chietKhau;
      }

      tongTien += tongTienDon;

      tongChietKhau +=
        tongTienDon - thanhTienSauCK;

      resultDonHang.push({
        donHang: donHang._id,

        tongTien: tongTienDon,

        chietKhau,

        loaiChietKhau:
          item.loaiChietKhau || "tienMat",

        thanhTienSauCK,
      });
    }

    // ✅ Thành tiền cuối cùng
    const thanhTien =
      tongTien -
      tongChietKhau +
      Number(thue) +
      Number(chiPhiKhac);

    // ✅ Thanh toán ban đầu
    const daThanhToan = 0;

    const conLai = thanhTien;

    const hoaDon = new HoaDon({
      nhaKhoa: nhaKhoaId,

      danhSachDonHang: resultDonHang,

      tongTien,
      tongChietKhau,
      thanhTien,

      daThanhToan,
      conLai,

      thue,
      chiPhiKhac,

      ghiChuNoiBo,
      ghiChuChoKhachHang,

      chinhSachThanhToan,
    });

    await hoaDon.save();

    // 🔥 Cập nhật trạng thái đơn hàng
    await DonHang.updateMany(
      {
        _id: {
          $in: resultDonHang.map((i) => i.donHang),
        },
      },
      {
        $set: {
          daXuatHoaDon: true,
        },
      }
    );

    res.json({
      success: true,
      data: hoaDon,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN - LẤY TẤT CẢ HÓA ĐƠN =================
// ================= ADMIN - LẤY TẤT CẢ HÓA ĐƠN =================
exports.getAllHoaDonAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    const {
      trangThai,
      search,
      nhaKhoaId,
      fromDate,
      toDate,
    } = req.query;

    let query = {};

    /* ================= LỌC TRẠNG THÁI ================= */
    if (trangThai) {
      query.trangThai = trangThai;
    }

    /* ================= LỌC NHA KHOA ================= */
    if (
      nhaKhoaId &&
      mongoose.Types.ObjectId.isValid(nhaKhoaId)
    ) {
      query.nhaKhoa = nhaKhoaId;
    }

    /* ================= LỌC NGÀY ================= */
    if (fromDate || toDate) {
      query.ngayXuatHoaDon = {};

      if (fromDate) {
        query.ngayXuatHoaDon.$gte = new Date(fromDate);
      }

      if (toDate) {
        const endDate = new Date(toDate);

        endDate.setHours(23, 59, 59, 999);

        query.ngayXuatHoaDon.$lte = endDate;
      }
    }

    /* ================= SEARCH ================= */
    if (search && search.trim() !== "") {
      const keyword = search.trim();

      const searchConditions = [];

      // search theo _id
      if (
        mongoose.Types.ObjectId.isValid(keyword)
      ) {
        searchConditions.push({
          _id: keyword,
        });
      }

      // search theo mã TANxxxx
      searchConditions.push({
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                "TAN",
                {
                  $toUpper: {
                    $substrCP: [
                      { $toString: "$_id" },
                      16,
                      8,
                    ],
                  },
                },
              ],
            },
            regex: keyword,
            options: "i",
          },
        },
      });

      query.$or = searchConditions;
    }

    /* ================= QUERY ================= */

    const total =
      await HoaDon.countDocuments(query);

    const danhSach = await HoaDon.find(query)
      .populate(
        "nhaKhoa",
        "hoVaTen tinh"
      )
      .populate({
        path: "danhSachDonHang.donHang",

        select: "_id danhSachSanPham",

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

      totalPages: Math.ceil(
        total / limit
      ),

      currentPage: page,

      data: danhSach,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= LẤY HÓA ĐƠN THEO NHA KHOA =================
exports.getAllHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;

    const {
      search,
      trangThai,
    } = req.query;

    let query = {
      nhaKhoa: nhaKhoaId,
    };

    // ✅ Lọc trạng thái
    if (trangThai) {
      query.trangThai = trangThai;
    }

    // ✅ Search
    if (search) {
      query.$or = [
        {
          _id: search.match(
            /^[0-9a-fA-F]{24}$/
          )
            ? search
            : null,
        },
      ];
    }

    const danhSachHoaDon =
      await HoaDon.find(query)
        .populate(
          "nhaKhoa",
          "tenNhaKhoa"
        )
        .populate({
          path: "danhSachDonHang.donHang",

          populate: {
            path: "nguoiLienHe",

            select: "hoVaTen",
          },
        })
        .sort({ createdAt: -1 });

    res.json({
      success: true,

      count: danhSachHoaDon.length,

      data: danhSachHoaDon,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= LẤY CHI TIẾT HÓA ĐƠN THEO ID =================
exports.getHoaDonById = async (req, res) => {
  try {
    const { id } = req.params;

    const hoaDon = await HoaDon.findById(id)
      .populate(
        "nhaKhoa",
        "tenNhaKhoa hoVaTen soDienThoai email diaChi tinh"
      )
      .populate({
        path: "danhSachDonHang.donHang",

        populate: [
          {
            path: "bacSi",
            select: "hoVaTen",
          },
          {
            path: "benhNhan",
            select:
              "hoVaTen soDienThoai email",
          },
          {
            path: "danhSachSanPham.sanPham",
            select:
              "tenSanPham maSanPham",
          },
        ],
      });

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    res.json({
      success: true,
      data: hoaDon,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CẬP NHẬT HÓA ĐƠN =================
exports.updateHoaDon = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      trangThai,
      danhSachDonHang,

      thue,
      chiPhiKhac,

      ghiChuNoiBo,
      ghiChuChoKhachHang,

      chinhSachThanhToan,
    } = req.body;

    let hoaDon =
      await HoaDon.findById(id);

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy hóa đơn",
      });
    }

    // ================= UPDATE TRẠNG THÁI =================
    if (trangThai) {
      hoaDon.trangThai = trangThai;
    }

    // ================= UPDATE FIELD MỚI =================
    if (thue !== undefined) {
      hoaDon.thue = Number(thue);
    }

    if (chiPhiKhac !== undefined) {
      hoaDon.chiPhiKhac =
        Number(chiPhiKhac);
    }

    if (ghiChuNoiBo !== undefined) {
      hoaDon.ghiChuNoiBo =
        ghiChuNoiBo;
    }

    if (
      ghiChuChoKhachHang !== undefined
    ) {
      hoaDon.ghiChuChoKhachHang =
        ghiChuChoKhachHang;
    }

    if (
      chinhSachThanhToan !== undefined
    ) {
      hoaDon.chinhSachThanhToan =
        chinhSachThanhToan;
    }

    /* ================= UPDATE DANH SÁCH ĐƠN HÀNG ================= */
    if (danhSachDonHang) {
      // 👉 Danh sách cũ
      const oldIds =
        hoaDon.danhSachDonHang.map((i) =>
          i.donHang.toString()
        );

      // 👉 Danh sách mới
      const newIds =
        danhSachDonHang.map((i) =>
          typeof i.donHang === "object"
            ? i.donHang._id.toString()
            : i.donHang.toString()
        );

      // 🔥 Đơn bị remove
      const removedIds = oldIds.filter(
        (id) => !newIds.includes(id)
      );

      // 🔥 Rollback trạng thái
      if (removedIds.length > 0) {
        await DonHang.updateMany(
          {
            _id: {
              $in: removedIds,
            },
          },
          {
            $set: {
              daXuatHoaDon: false,
            },
          }
        );
      }

      //🔥 Set lại các đơn hiện tại thành đã xuất hóa đơn
      await DonHang.updateMany(
        {
          _id: {
            $in: newIds,
          },
        },
        {
          $set: {
            daXuatHoaDon: true,
          },
        }
      );
      // ✅ Gán danh sách mới
      hoaDon.danhSachDonHang =
        danhSachDonHang;

      // ✅ Tính lại tiền
      let moiTongTien = 0;

      let moiTongChietKhau = 0;

      hoaDon.danhSachDonHang.forEach(
        (item) => {
          moiTongTien +=
            item.tongTien || 0;

          moiTongChietKhau +=
            (item.tongTien || 0) -
            (item.thanhTienSauCK || 0);
        }
      );

      hoaDon.tongTien =
        moiTongTien;

      hoaDon.tongChietKhau =
        moiTongChietKhau;

      hoaDon.thanhTien =
        moiTongTien -
        moiTongChietKhau +
        Number(
          hoaDon.chiPhiKhac || 0
        );

      hoaDon.thanhTien += hoaDon.thanhTien * (hoaDon.thue / 100)

      hoaDon.conLai =
        hoaDon.thanhTien -
        hoaDon.daThanhToan;
    }

    const updatedHoaDon =
      await hoaDon.save();

    res.json({
      success: true,

      message:
        "Cập nhật hóa đơn thành công",

      data: updatedHoaDon,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= THANH TOÁN HÓA ĐƠN =================
exports.thanhToanHoaDon = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const { soTienThanhToan } =
      req.body;

    if (
      !soTienThanhToan ||
      soTienThanhToan <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Số tiền thanh toán không hợp lệ",
      });
    }

    const hoaDon =
      await HoaDon.findById(id);

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy hóa đơn",
      });
    }

    // ❌ Không cho trả dư
    if (
      soTienThanhToan >
      hoaDon.conLai
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Số tiền vượt quá số tiền còn lại",
      });
    }

    // ✅ Update tiền
    hoaDon.daThanhToan +=
      Number(soTienThanhToan);

    hoaDon.conLai =
      hoaDon.thanhTien -
      hoaDon.daThanhToan;

    // ✅ Update trạng thái
    if (hoaDon.conLai === 0) {
      hoaDon.trangThai =
        "Đã thanh toán";
    } else {
      hoaDon.trangThai =
        "Thanh toán một phần";
    }

    await hoaDon.save();

    res.json({
      success: true,
      message:
        "Thanh toán thành công",
      data: hoaDon,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= XÓA HÓA ĐƠN =================
exports.deleteHoaDon = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const hoaDon =
      await HoaDon.findById(id);

    if (!hoaDon) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy hóa đơn",
      });
    }

    const trangThai =
      hoaDon.trangThai;

    // ❌ Không cho xóa nếu thanh toán một phần
    if (
      trangThai ===
      "Thanh toán một phần"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể xóa hóa đơn đã thanh toán một phần",
      });
    }

    // 🔥 Rollback nếu chưa thanh toán
    if (
      trangThai ===
      "Chưa thanh toán"
    ) {
      const donHangIds =
        hoaDon.danhSachDonHang.map(
          (item) =>
            item.donHang.toString()
        );

      if (donHangIds.length > 0) {
        await DonHang.updateMany(
          {
            _id: {
              $in: donHangIds,
            },
          },
          {
            $set: {
              daXuatHoaDon: false,
            },
          }
        );
      }
    }

    // ✅ Xóa hóa đơn
    await HoaDon.findByIdAndDelete(id);

    res.json({
      success: true,
      message:
        "Xóa hóa đơn thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= LẤY HÓA ĐƠN CHƯA THANH TOÁN THEO NHA KHOA =================
exports.getHoaDonChuaThanhToanByNhaKhoa = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;

    const danhSach = await HoaDon.find({
      nhaKhoa: nhaKhoaId,
      trangThai: { $in: ["Chưa thanh toán", "Thanh toán một phần"] },
    })
      .select("_id ngayXuatHoaDon thanhTien daThanhToan conLai trangThai")
      .sort({ ngayXuatHoaDon: -1 });

    res.json({ success: true, data: danhSach });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
const mongoose = require("mongoose");
const HoaDon = require("../models/HoaDon");
const DonHang = require("../models/DonHang");
const BangGia = require("../models/BangGia");
const SanPham = require("../models/SanPham");

const roundMoney = (n) =>
  Math.round(Number(n || 0));

const calculateThanhTien = ({
  tongTien,
  tongChietKhau,
  thue,
  chiPhiKhac,
}) => {
  let thanhTien =
    Number(tongTien || 0) -
    Number(tongChietKhau || 0);

  // phí khác
  thanhTien += Number(
    chiPhiKhac || 0
  );

  // thuế %
  thanhTien +=
    thanhTien *
    (Number(thue || 0) / 100);

  return roundMoney(thanhTien);
};

// ================= LẤY DANH SÁCH ĐƠN HÀNG CHƯA XUẤT HÓA ĐƠN =================
exports.getDonHangChuaXuatHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.params;

    const donHangs = await DonHang.find({
      nhaKhoa: nhaKhoaId,
      daXuatHoaDon: { $ne: true },
      //Chỉ lấy đơn hàng có loại đơn là mới
      "danhSachSanPham.loaiDon": "Mới",
    })
      .populate("bacSi", "hoVaTen")
      .populate("benhNhan", "hoVaTen")
      .sort({ createdAt: -1 });

    res.json(donHangs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ĐẾM SỐ ĐƠN HÀNG CHƯA XUẤT HÓA ĐƠN CỦA TẤT CẢ NHA KHOA =================
exports.countDonHangChuaXuatHoaDonAll = async (
  req,
  res
) => {
  try {
    const result =
      await DonHang.aggregate([
        {
          $match: {
            daXuatHoaDon: {
              $ne: true,
            },

            // 🔥 chỉ lấy đơn có loaiDon = "Mới"
            "danhSachSanPham.loaiDon":
              "Mới",
          },
        },

        /* ================= GROUP THEO NHA KHOA ================= */

        {
          $group: {
            _id: "$nhaKhoa",

            soDonHangChuaXuatHoaDon:
            {
              $sum: 1,
            },

            // 🔥 ngày nhận đơn hàng gần nhất chưa xuất
            ngayDonHangGanNhat: {
              $max: "$ngayNhan",
            },
          },
        },

        /* ================= LẤY THÔNG TIN NHA KHOA ================= */

        {
          $lookup: {
            from: "nhakhoas",

            localField: "_id",

            foreignField: "_id",

            as: "nhaKhoa",
          },
        },

        {
          $unwind: "$nhaKhoa",
        },

        /* ================= LẤY NGÀY XUẤT HÓA ĐƠN CUỐI ================= */

        {
          $lookup: {
            from: "hoadons",

            let: {
              nhaKhoaId:
                "$nhaKhoa._id",
            },

            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      "$nhaKhoa",
                      "$$nhaKhoaId",
                    ],
                  },
                },
              },

              {
                $sort: {
                  ngayXuatHoaDon:
                    -1,
                },
              },

              {
                $limit: 1,
              },

              {
                $project: {
                  _id: 0,

                  ngayXuatHoaDon: 1,

                  thanhTien: 1,

                  trangThai: 1,
                },
              },
            ],

            as: "hoaDonGanNhat",
          },
        },

        {
          $unwind: {
            path: "$hoaDonGanNhat",

            preserveNullAndEmptyArrays: true,
          },
        },

        /* ================= PROJECT ================= */

        {
          $project: {
            _id: 0,

            nhaKhoaId:
              "$nhaKhoa._id",

            tenNhaKhoa:
              "$nhaKhoa.tenNhaKhoa",

            hoVaTen:
              "$nhaKhoa.hoVaTen",

            tinh:
              "$nhaKhoa.tinh",

            soDonHangChuaXuatHoaDon: 1,

            // 🔥 ngày đơn hàng chưa xuất gần nhất
            ngayDonHangGanNhat: 1,

            // 🔥 hóa đơn gần nhất
            ngayXuatHoaDonCuoi:
              "$hoaDonGanNhat.ngayXuatHoaDon",

            hoaDonGanNhat:
              "$hoaDonGanNhat",
          },
        },

        /* ================= SORT ================= */

        {
          $sort: {
            soDonHangChuaXuatHoaDon:
              -1,
          },
        },
      ]);

    res.json({
      success: true,

      totalNhaKhoa:
        result.length,

      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,

      message: err.message,
    });
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
exports.createHoaDon = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        const {
          nhaKhoaId,
          danhSachDonHang,

          thue = 0,
          chiPhiKhac = 0,

          ghiChuNoiBo = "",
          ghiChuChoKhachHang = "",

          chinhSachThanhToan =
          "Thanh toán cuối tháng",
        } = req.body;

        // ===== VALIDATE =====

        if (
          !danhSachDonHang ||
          danhSachDonHang.length === 0
        ) {
          throw new Error(
            "Danh sách đơn hàng trống"
          );
        }

        let tongTien = 0;

        let tongChietKhau = 0;

        const resultDonHang = [];

        for (const item of danhSachDonHang) {
          const donHang =
            await DonHang.findById(
              item.donHangId
            ).session(session);

          if (!donHang) {
            throw new Error(
              "Không tìm thấy đơn hàng"
            );
          }

          // ===== CHỐNG XUẤT TRÙNG =====

          const updated =
            await DonHang.updateOne(
              {
                _id: donHang._id,

                daXuatHoaDon: {
                  $ne: true,
                },
              },
              {
                $set: {
                  daXuatHoaDon: true,
                },
              },
              { session }
            );

          if (
            updated.modifiedCount === 0
          ) {
            throw new Error(
              `Đơn hàng ${donHang._id} đã xuất hóa đơn`
            );
          }

          const tongTienDon =
            await tinhTienDonHang(
              donHang,
              nhaKhoaId
            );

          let chietKhau =
            Number(
              item.chietKhau || 0
            );

          if (chietKhau < 0) {
            throw new Error(
              "Chiết khấu không hợp lệ"
            );
          }

          let thanhTienSauCK =
            tongTienDon;

          if (
            item.loaiChietKhau ===
            "phanTram"
          ) {
            thanhTienSauCK =
              tongTienDon *
              (1 -
                chietKhau / 100);
          } else {
            thanhTienSauCK =
              tongTienDon -
              chietKhau;
          }

          thanhTienSauCK =
            Math.max(
              0,
              thanhTienSauCK
            );

          tongTien += tongTienDon;

          tongChietKhau +=
            tongTienDon -
            thanhTienSauCK;

          resultDonHang.push({
            donHang: donHang._id,

            tongTien:
              roundMoney(
                tongTienDon
              ),

            chietKhau,

            loaiChietKhau:
              item.loaiChietKhau ||
              "tienMat",

            thanhTienSauCK:
              roundMoney(
                thanhTienSauCK
              ),
          });
        }

        const thanhTien =
          calculateThanhTien({
            tongTien,
            tongChietKhau,
            thue,
            chiPhiKhac,
          });

        const hoaDon =
          await HoaDon.create(
            [
              {
                nhaKhoa:
                  nhaKhoaId,

                danhSachDonHang:
                  resultDonHang,

                tongTien:
                  roundMoney(
                    tongTien
                  ),

                tongChietKhau:
                  roundMoney(
                    tongChietKhau
                  ),

                thanhTien,

                daThanhToan: 0,

                conLai:
                  thanhTien,

                thue,

                chiPhiKhac,

                ghiChuNoiBo,

                ghiChuChoKhachHang,

                chinhSachThanhToan,
              },
            ],
            { session }
          );

        res.json({
          success: true,
          data: hoaDon[0],
        });
      }
    );
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    session.endSession();
  }
};
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

      // ================= SEARCH THEO SỐ HÓA ĐƠN =================
      searchConditions.push({
        soHoaDon: {
          $regex: keyword,
          $options: "i",
        },
      });

      // ================= SEARCH THEO MÃ TANxxxx =================
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

            regex: keyword.toUpperCase(),

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

      totalPages: Math.ceil(total / limit),

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

    // ================= RECALCULATE =================
    hoaDon.thanhTien = calculateThanhTien({
      tongTien: hoaDon.tongTien,
      tongChietKhau: hoaDon.tongChietKhau,
      thue: hoaDon.thue,
      chiPhiKhac: hoaDon.chiPhiKhac,
    });

    hoaDon.conLai = Math.max(
      0,
      roundMoney(
        hoaDon.thanhTien - hoaDon.daThanhToan
      )
    );

    // auto trạng thái
    if (hoaDon.conLai <= 0) {
      hoaDon.trangThai = "Đã thanh toán";
    } else if (hoaDon.daThanhToan > 0) {
      hoaDon.trangThai =
        "Thanh toán một phần";
    } else {
      hoaDon.trangThai =
        "Chưa thanh toán";
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

      // hoaDon.thanhTien =
      //   moiTongTien -
      //   moiTongChietKhau +
      //   Number(
      //     hoaDon.chiPhiKhac || 0
      //   );

      // hoaDon.thanhTien += hoaDon.thanhTien * (hoaDon.thue / 100)

      hoaDon.thanhTien =
        calculateThanhTien({
          tongTien: moiTongTien,
          tongChietKhau:
            moiTongChietKhau,
          thue: hoaDon.thue,
          chiPhiKhac:
            hoaDon.chiPhiKhac,
        });

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

    hoaDon.conLai = Math.max(
      0,
      roundMoney(
        hoaDon.thanhTien -
        hoaDon.daThanhToan
      )
    );

    if (hoaDon.conLai <= 0) {
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
  const session =
    await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        const { id } = req.params;

        const hoaDon =
          await HoaDon.findById(
            id
          ).session(session);

        if (!hoaDon) {
          throw new Error(
            "Không tìm thấy hóa đơn"
          );
        }

        if (
          hoaDon.trangThai ===
          "Thanh toán một phần"
        ) {
          throw new Error(
            "Không thể xóa hóa đơn đã thanh toán một phần"
          );
        }

        // rollback đơn hàng
        const donHangIds =
          hoaDon.danhSachDonHang.map(
            (item) =>
              item.donHang
          );

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
          },
          { session }
        );

        await HoaDon.findByIdAndDelete(
          id,
          { session }
        );

        res.json({
          success: true,
          message:
            "Xóa hóa đơn thành công",
        });
      }
    );
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    session.endSession();
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

exports.thongKeCongNoHoaDon = async (req, res) => {
  try {
    const { nhaKhoaId } = req.query;

    let query = {
      trangThai: {
        $in: ["Chưa thanh toán", "Thanh toán một phần"],
      },
    };

    // lọc theo nha khoa nếu có
    if (
      nhaKhoaId &&
      mongoose.Types.ObjectId.isValid(nhaKhoaId)
    ) {
      query.nhaKhoa = nhaKhoaId;
    }

    const hoaDons = await HoaDon.find(query);

    const now = new Date();

    let conNo = {
      soHoaDon: 0,
      tongTien: 0,
    };

    let treHan = {
      soHoaDon: 0,
      tongTien: 0,
    };

    let chuaDenHan = {
      soHoaDon: 0,
      tongTien: 0,
    };

    // ================= HÀM TÍNH NGÀY ĐẾN HẠN =================
    const getNgayDenHan = (
      ngayXuatHoaDon,
      chinhSachThanhToan
    ) => {
      const dueDate = new Date(ngayXuatHoaDon);

      switch (chinhSachThanhToan) {
        case "Thanh toán trước":
        case "Thanh toán ngay":
          return dueDate;

        case "Thanh toán trong 7 ngày":
          dueDate.setDate(dueDate.getDate() + 7);
          return dueDate;

        case "Thanh toán trong 10 ngày":
          dueDate.setDate(dueDate.getDate() + 10);
          return dueDate;

        case "Thanh toán trong 30 ngày":
          dueDate.setDate(dueDate.getDate() + 30);
          return dueDate;

        case "Thanh toán trong 60 ngày":
          dueDate.setDate(dueDate.getDate() + 60);
          return dueDate;

        case "Thanh toán trong 90 ngày":
          dueDate.setDate(dueDate.getDate() + 90);
          return dueDate;

        case "Thanh toán cuối tháng":
          dueDate.setMonth(dueDate.getMonth() + 1);
          dueDate.setDate(0);
          dueDate.setHours(23, 59, 59, 999);
          return dueDate;

        default:
          return dueDate;
      }
    };

    // ================= DUYỆT HÓA ĐƠN =================
    for (const hd of hoaDons) {
      const soTienConLai =
        Number(hd.conLai || 0);

      // ===== CÒN NỢ =====
      conNo.soHoaDon += 1;
      conNo.tongTien += soTienConLai;

      // ===== NGÀY ĐẾN HẠN =====
      const ngayDenHan = getNgayDenHan(
        hd.ngayXuatHoaDon,
        hd.chinhSachThanhToan
      );

      // ===== TRỄ HẠN =====
      if (now > ngayDenHan) {
        treHan.soHoaDon += 1;
        treHan.tongTien += soTienConLai;
      } else {
        // ===== CHƯA ĐẾN HẠN =====
        chuaDenHan.soHoaDon += 1;
        chuaDenHan.tongTien += soTienConLai;
      }
    }

    res.json({
      success: true,
      data: {
        conNo,
        treHan,
        chuaDenHan,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
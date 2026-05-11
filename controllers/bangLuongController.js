const BangLuong = require("../models/BangLuong");
const NhanVien = require("../models/NhanVien");


// Tính lương
exports.createBangLuong = async (
  req,
  res
) => {
  try {
    const {
      thang,
      nam,
      nhanVien,
      soNgayCong,
      phuCapCom,
      phuCapDienThoai,
      thuong,
      phat,
      ungTruoc,
      ghiChu,
    } = req.body;

    // kiểm tra nhân viên
    const nv =
      await NhanVien.findById(
        nhanVien
      );

    if (!nv) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy nhân viên",
      });
    }

    // lương/ngày
    const luongMotNgay =
      nv.luongCanBan / 28;

    // tiền công
    const thanhTienCong =
      luongMotNgay * soNgayCong;

    // tổng phụ cấp
    const tongPhuCap =
      Number(phuCapCom || 0) +
      Number(phuCapDienThoai || 0) +
      Number(thuong || 0);

    // tổng lương
    const tongLuong =
      thanhTienCong +
      tongPhuCap;

    // thực nhận
    const thucNhan =
      tongLuong -
      Number(ungTruoc || 0) -
      Number(phat || 0);

    // kiểm tra tồn tại
    let bangLuong =
      await BangLuong.findOne({
        thang,
        nam,
        nhanVien,
      });

    // ================= UPDATE =================
    if (bangLuong) {
      bangLuong.soNgayCong =
        soNgayCong;

      bangLuong.phuCapCom =
        phuCapCom;

      bangLuong.phuCapDienThoai =
        phuCapDienThoai;

      bangLuong.thuong = thuong;

      bangLuong.phat = phat;

      bangLuong.ungTruoc =
        ungTruoc;

      bangLuong.ghiChu =
        ghiChu;

      bangLuong.luongCanBan =
        nv.luongCanBan;

      bangLuong.luongMotNgay =
        luongMotNgay;

      bangLuong.thanhTienCong =
        thanhTienCong;

      bangLuong.tongPhuCap =
        tongPhuCap;

      bangLuong.tongLuong =
        tongLuong;

      bangLuong.thucNhan =
        thucNhan;

      await bangLuong.save();

      bangLuong =
        await BangLuong.findById(
          bangLuong._id
        ).populate("nhanVien");

      return res.json({
        success: true,
        type: "update",
        message:
          "Cập nhật bảng lương thành công",
        data: bangLuong,
      });
    }

    // ================= CREATE =================
    bangLuong =
      await BangLuong.create({
        thang,
        nam,

        nhanVien,

        luongCanBan:
          nv.luongCanBan,

        luongMotNgay,

        soNgayCong,

        thanhTienCong,

        phuCapCom,

        phuCapDienThoai,

        thuong,

        phat,

        ungTruoc,

        tongPhuCap,

        tongLuong,

        thucNhan,

        ghiChu,
      });

    bangLuong =
      await BangLuong.findById(
        bangLuong._id
      ).populate("nhanVien");

    res.json({
      success: true,
      type: "create",
      message:
        "Tạo bảng lương thành công",
      data: bangLuong,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// Danh sách bảng lương
exports.getAllBangLuong = async (req, res) => {
  try {
    const {
      thang,
      nam,
      nhanVien,
    } = req.query;

    let query = {};

    if (thang) {
      query.thang = thang;
    }

    if (nam) {
      query.nam = nam;
    }

    if (nhanVien) {
      query.nhanVien = nhanVien;
    }

    const data = await BangLuong.find(query)
      .populate("nhanVien")
      .sort({
        createdAt: -1,
      });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};



// Chi tiết
exports.getBangLuongById = async (req, res) => {
  try {
    const data = await BangLuong.findById(
      req.params.id
    ).populate("nhanVien");

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// Xóa bảng lương
exports.deleteBangLuong = async (req, res) => {
  try {
    await BangLuong.findByIdAndDelete(
      req.params.id
    );

    res.json({
      success: true,
      message:
        "Xóa bảng lương thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Xóa tất cả bảng lương theo tháng/năm
exports.deleteBangLuongByMonthYear =
  async (req, res) => {
    try {
      const { thang, nam } =
        req.query;

      if (!thang || !nam) {
        return res.status(400).json({
          success: false,
          message:
            "Vui lòng truyền tháng và năm",
        });
      }

      const result =
        await BangLuong.deleteMany({
          thang,
          nam,
        });

      res.json({
        success: true,
        message: `Đã xóa ${result.deletedCount} bảng lương`,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };
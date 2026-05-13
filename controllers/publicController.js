const PhieuBaoHanh = require("../models/PhieuBaoHanh");

const buildPublicPhieuBaoHanh = (phieu) => {
  const today = new Date();

  const danhSachSanPham = (phieu.danhSachBaoHanh || []).map((item) => {
    const baoHanhDen = new Date(item.baoHanhDen);
    const isValid = today <= baoHanhDen;
    const daysRemaining = Math.ceil((baoHanhDen - today) / (1000 * 60 * 60 * 24));

    return {
      tenSanPham: item.sanPham?.tenSanPham || "---",
      sanPham: item.sanPham
        ? {
            ten: item.sanPham.tenSanPham,
            tenSanPham: item.sanPham.tenSanPham,
          }
        : null,
      viTriRang: item.viTriRang || "---",
      soLuong: item.soLuong || 1,
      mau: item.mau || "---",
      baoHanhTu: item.baoHanhTu,
      baoHanhDen: item.baoHanhDen,
      isValid,
      daysRemaining,
      status: isValid
        ? `Còn hiệu lực (${daysRemaining} ngày)`
        : `Hết hiệu lực (${Math.abs(daysRemaining)} ngày)`,
    };
  });

  const firstItem = danhSachSanPham[0] || null;
  const overallIsValid = danhSachSanPham.some((item) => item.isValid);
  const overallDaysRemaining = firstItem?.daysRemaining || 0;

  return {
    maBaoHanh: phieu.maBaoHanh,
    maQR: phieu.maQR,
    ngayTao: phieu.createdAt,
    danhSachSanPham,
    sanPham: firstItem
      ? {
          ten: firstItem.tenSanPham,
          tenSanPham: firstItem.tenSanPham,
        }
      : null,
    viTriRang: firstItem?.viTriRang || null,
    soLuong: firstItem?.soLuong || null,
    mauTheTi: phieu.mauTheTi,
    nhaKhoa: phieu.nhaKhoa
      ? {
          ten: phieu.nhaKhoa.tenGiaoDich || phieu.nhaKhoa.hoVaTen,
          tenGiaoDich: phieu.nhaKhoa.tenGiaoDich,
          hoVaTen: phieu.nhaKhoa.hoVaTen,
          diaChi: phieu.nhaKhoa.diaChiCuThe || phieu.nhaKhoa.diaChi,
          soDienThoai: phieu.nhaKhoa.soDienThoai,
        }
      : null,
    benhNhan: phieu.benhNhan
      ? {
          ten: phieu.benhNhan.hoVaTen,
          hoVaTen: phieu.benhNhan.hoVaTen,
          soDienThoai: phieu.benhNhan.soDienThoai,
          email: phieu.benhNhan.email,
          diaChi: phieu.benhNhan.diaChi,
        }
      : null,
    bacSi: phieu.bacSi
      ? {
          ten: phieu.bacSi.hoVaTen,
          hoVaTen: phieu.bacSi.hoVaTen,
        }
      : null,
    soDienThoai: phieu.soDienThoai || phieu.benhNhan?.soDienThoai || null,
    ghiChu: phieu.ghiChu,
    // Status info
    isValid: overallIsValid,
    daysRemaining: overallDaysRemaining,
    status: overallIsValid 
      ? `Còn hiệu lực (${overallDaysRemaining} ngày)` 
      : `Hết hiệu lực (${Math.abs(overallDaysRemaining)} ngày)`,
  };
};


exports.checkWarranty = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã tra cứu",
      });
    }

    // Build search variants
    const variants = [code];
    if (code && !code.toUpperCase().startsWith("TAN")) {
      variants.push(`TAN${code}`);
      variants.push(`TANBH${code}`);
    }

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapeRegex(code), "i");

    // Tìm kiếm phiếu bảo hành
    let phieu = await PhieuBaoHanh.findOne({
      $or: [
        { maBaoHanh: { $in: variants } },
        { maQR: code },
        { maBaoHanh: { $regex: regex } },
        { maBaoHanh: { $regex: new RegExp(escapeRegex(code).replace(/\\s+/g, ""), "i") } },
      ],
    })
      .populate("donHang")
      .populate("nhaKhoa", "hoVaTen tenGiaoDich diaChiCuThe quanHuyen tinh quocGia soDienThoai email moTa")
      .populate("benhNhan", "hoVaTen soDienThoai")
      .populate("bacSi", "hoVaTen")
      .populate({ path: "danhSachBaoHanh.sanPham", select: "tenSanPham" });

    if (!phieu) {
      // Fallback: tìm theo mã đơn hàng trong collection DonHang
      try {
        const DonHang = require("../models/DonHang");
        const donHangRecord = await DonHang.findOne({ maDonHang: { $in: variants } });
        
        if (donHangRecord) {
          phieu = await PhieuBaoHanh.findOne({ donHang: donHangRecord._id })
            .populate("donHang")
            .populate("nhaKhoa", "hoVaTen tenGiaoDich diaChiCuThe quanHuyen tinh quocGia soDienThoai email moTa")
            .populate("benhNhan", "hoVaTen soDienThoai")
            .populate("bacSi", "hoVaTen")
            .populate("sanPham", "tenSanPham");
        }
      } catch (err) {
        // Silent error for fallback
      }

      if (!phieu) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy phiếu bảo hành",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: buildPublicPhieuBaoHanh(phieu),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tra cứu phiếu bảo hành",
      error: error.message,
    });
  }
};

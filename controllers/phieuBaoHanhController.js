const PhieuBaoHanh = require("../models/PhieuBaoHanh");
const DonHang = require("../models/DonHang");
const NhaKhoa = require("../models/NhaKhoa");

const generateUniqueQRCode = async () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let maQR = "";
    for (let i = 0; i < 4; i += 1) {
      maQR += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existingQR = await PhieuBaoHanh.findOne({ maQR });
    if (!existingQR) {
      return maQR;
    }
  }

  throw new Error("Không thể sinh mã QR duy nhất");
};

// [POST] Tạo hoặc cập nhật phiếu bảo hành (1 phiếu cho cả đơn hàng)
exports.createPhieuBaoHanh = async (req, res) => {
  try {
    // 1. SỬA ĐỔI: Khai báo mauTheId thay vì mauTheTi
    const { donHang, danhSachBaoHanh, mauTheId, ghiChu, nhakhoabh, bacsibh, benhnhanbh } = req.body;

    // 2. Kiểm tra bắt buộc mẫu thẻ
    if (!mauTheId) {
        return res.status(400).json({ success: false, message: "Vui lòng chọn mẫu thẻ bảo hành" });
    }

    if (!donHang) {
      return res.status(400).json({ success: false, message: "Thiếu mã đơn hàng" });
    }

    if (!Array.isArray(danhSachBaoHanh) || danhSachBaoHanh.length === 0) {
      return res.status(400).json({ success: false, message: "Phiếu bảo hành phải có ít nhất 1 sản phẩm" });
    }

    // Kiểm tra phiếu bảo hành đã tồn tại chưa
    let phieu = await PhieuBaoHanh.findOne({ donHang });

    // Lấy thông tin đơn hàng
    const donHangRecord = await DonHang.findById(donHang);
    
    // Nếu tạo mới hoàn toàn, bắt buộc đơn hàng phải tồn tại
    if (!phieu && !donHangRecord) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng để tạo phiếu bảo hành" });
    }

    // Xử lý phiếu bảo hành mồ côi (tránh lỗi E11000 trùng mã bảo hành khi đơn hàng cũ đã bị xóa)
    const maBaoHanhTarget = donHangRecord?.maDonHang;
    if (maBaoHanhTarget) {
      const phieuTrungMa = await PhieuBaoHanh.findOne({ maBaoHanh: maBaoHanhTarget });
      if (phieuTrungMa && phieuTrungMa.donHang?.toString() !== donHang) {
        const oldOrderExists = await DonHang.findById(phieuTrungMa.donHang);
        if (!oldOrderExists) {
          // Đơn hàng cũ không còn tồn tại -> Xóa phiếu bảo hành mồ côi này đi
          await PhieuBaoHanh.findByIdAndDelete(phieuTrungMa._id);
        } else {
          // Đơn hàng cũ vẫn tồn tại -> Trùng mã thực tế, báo lỗi cho Client
          return res.status(400).json({
            success: false,
            message: `Mã bảo hành ${maBaoHanhTarget} đã được sử dụng cho một đơn hàng khác.`
          });
        }
      }
    }

    const nhaKhoaRecord = donHangRecord && donHangRecord.nhaKhoa
      ? await NhaKhoa.findById(donHangRecord.nhaKhoa).select("hoVaTen tenGiaoDich soDienThoai")
      : null;

    const safeDanhSachBaoHanh = danhSachBaoHanh
      .filter((item) => item && item.sanPham && item.baoHanhTu && item.baoHanhDen)
      .map((item) => ({
        sanPham: item.sanPham,
        viTriRang: item.viTriRang || "",
        soLuong: Number(item.soLuong) || 1,
        mau: item.mau || "",
        tenSanPhamBaoHanh: item.tenSanPhamBaoHanh || "",
        baoHanhTu: item.baoHanhTu,
        baoHanhDen: item.baoHanhDen,
      }));

    if (safeDanhSachBaoHanh.length === 0) {
      return res.status(400).json({ success: false, message: "Dữ liệu sản phẩm bảo hành không hợp lệ" });
    }

    // 3. SỬA ĐỔI: Dùng mauThe (đúng tên field trong Schema) thay vì mauTheTi
    const baseData = {
      donHang,
      nhaKhoa: donHangRecord ? donHangRecord.nhaKhoa : (phieu ? phieu.nhaKhoa : null),
      bacSi: donHangRecord ? donHangRecord.bacSi : (phieu ? phieu.bacSi : null),
      benhNhan: donHangRecord ? donHangRecord.benhNhan : (phieu ? phieu.benhNhan : null),
      mauThe: mauTheId, // Lưu ID của mẫu thẻ (ObjectId)
      soDienThoai: donHangRecord ? (nhaKhoaRecord?.soDienThoai || "") : (phieu ? phieu.soDienThoai : ""),
      ghiChu: ghiChu || "",
      nhakhoabh: nhakhoabh || "",
      bacsibh: bacsibh || "",
      benhnhanbh: benhnhanbh || "",
    };

    if (phieu) {
      // Ghi đè danh sách sản phẩm bảo hành bằng dữ liệu mới nhất từ client gửi lên (giúp đồng bộ cập nhật số lượng, vị trí răng, màu sắc, thời hạn bảo hành...)
      phieu.danhSachBaoHanh = safeDanhSachBaoHanh;
      Object.assign(phieu, baseData);
    } else {
      // Tạo phiếu bảo hành mới (bắt buộc có donHangRecord)
      const donHangCodeForRef = (donHangRecord.maDonHang || "").toUpperCase();
      const donHangSuffix = donHangCodeForRef
        ? donHangCodeForRef.slice(-6)
        : donHangRecord._id.toString().substring(donHangRecord._id.toString().length - 6).toUpperCase();

      const maBaoHanhFromOrder = donHangRecord.maDonHang || null;

      phieu = new PhieuBaoHanh({
        ...baseData,
        danhSachBaoHanh: safeDanhSachBaoHanh,
        maBaoHanh: maBaoHanhFromOrder || `TANBH${donHangSuffix}`,
        maQR: await generateUniqueQRCode(), // Đảm bảo hàm này đã được định nghĩa ở đâu đó trong file
      });
    }

    if (donHangRecord && donHangRecord.maDonHang) {
      phieu.maBaoHanh = donHangRecord.maDonHang;
    }
    
    await phieu.save();

    // Populate dữ liệu để trả về
    const populatedPhieu = await PhieuBaoHanh.findById(phieu._id)
      .populate("donHang", "maDonHang ngayNhan")
      .populate("nhaKhoa", "tenGiaoDich hoVaTen")
      .populate("bacSi", "hoVaTen soDienThoai")
      .populate("benhNhan", "hoVaTen soDienThoai")
      .populate("danhSachBaoHanh.sanPham", "tenSanPham")
      .populate("mauThe", "tenMau"); // Populate thêm cả mẫu thẻ để frontend hiển thị tên

    res.status(201).json({
      success: true,
      message: phieu.isNew ? "Tạo phiếu bảo hành thành công" : "Cập nhật phiếu bảo hành thành công",
      data: populatedPhieu,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo/cập nhật phiếu bảo hành",
      error: error.message,
    });
  }
};

// [GET] Lấy tất cả phiếu bảo hành
exports.getAllPhieuBaoHanh = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const nhaKhoaId = req.query.nhaKhoaId;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;

    let query = {};
    
    if (nhaKhoaId && nhaKhoaId !== "all") {
      query.nhaKhoa = nhaKhoaId;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    if (search && search.trim() !== "") {
      const keyword = search.trim();
      
      // Tìm trước ID của Đơn hàng và Bệnh nhân khớp với keyword
      const [donHangs, benhNhans] = await Promise.all([
        DonHang.find({ maDonHang: { $regex: keyword, $options: "i" } }).select("_id"),
        require("../models/BenhNhan").find({ hoVaTen: { $regex: keyword, $options: "i" } }).select("_id"),
      ]);

      const donHangIds = donHangs.map(d => d._id);
      const benhNhanIds = benhNhans.map(b => b._id);

      query.$or = [
        { maBaoHanh: { $regex: keyword, $options: "i" } },
        { donHang: { $in: donHangIds } },
        { benhNhan: { $in: benhNhanIds } }
      ];
    }

    const total = await PhieuBaoHanh.countDocuments(query);

    const phieus = await PhieuBaoHanh.find(query)
      .populate({
        path: "donHang",
        select: "_id maDonHang ngayNhan",
      })
      .populate({
        path: "nhaKhoa",
        select: "hoVaTen tenGiaoDich",
      })
      .populate({
        path: "bacSi",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "benhNhan",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "danhSachBaoHanh.sanPham",
        select: "tenSanPham",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      count: phieus.length,
      data: phieus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiếu bảo hành",
      error: error.message,
    });
  }
};

// [GET] Lấy phiếu bảo hành theo đơn hàng
exports.getPhieuBaoHanhByDonHang = async (req, res) => {
  try {
    const { donHangId } = req.params;

    const phieu = await PhieuBaoHanh.findOne({ donHang: donHangId })
      .populate({
        path: "donHang",
        select: "maDonHang ngayNhan",
      })
      .populate({
        path: "nhaKhoa",
        select: "hoVaTen tenGiaoDich",
      })
      .populate({
        path: "bacSi",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "benhNhan",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "danhSachBaoHanh.sanPham",
        select: "tenSanPham",
      });

    res.status(200).json({
      success: true,
      data: phieu || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy phiếu bảo hành",
      error: error.message,
    });
  }
};

// [GET] Lấy chi tiết phiếu bảo hành
exports.getPhieuBaoHanhById = async (req, res) => {
  try {
    const phieu = await PhieuBaoHanh.findById(req.params.id)
      .populate({
        path: "donHang",
        select: "maDonHang ngayNhan",
      })
      .populate({
        path: "nhaKhoa",
      })
      .populate({
        path: "bacSi",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "benhNhan",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "danhSachBaoHanh.sanPham",
        select: "tenSanPham",
      });

    if (!phieu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành" });
    }

    res.status(200).json({ success: true, data: phieu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// [PUT] Cập nhật phiếu bảo hành
exports.updatePhieuBaoHanh = async (req, res) => {
  try {
    const updatedPhieu = await PhieuBaoHanh.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate({
        path: "donHang",
        select: "maDonHang ngayNhan",
      })
      .populate({
        path: "nhaKhoa",
      })
      .populate({
        path: "bacSi",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "benhNhan",
        select: "hoVaTen soDienThoai",
      })
      .populate({
        path: "danhSachBaoHanh.sanPham",
        select: "tenSanPham",
      });

    if (!updatedPhieu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành" });
    }

    res.status(200).json({ success: true, data: updatedPhieu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// [DELETE] Xóa phiếu bảo hành
exports.deletePhieuBaoHanh = async (req, res) => {
  try {
    const deletedPhieu = await PhieuBaoHanh.findByIdAndDelete(req.params.id);
    if (!deletedPhieu) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu bảo hành" });
    }
    res.status(200).json({ success: true, message: "Xóa phiếu bảo hành thành công" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

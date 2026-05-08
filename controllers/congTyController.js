const CongTy = require("../models/CongTy");

// 📖 Lấy thông tin công ty (chỉ có 1 bản ghi)
exports.getCompany = async (req, res) => {
  try {
    let company = await CongTy.findOne({ isActive: true });

    // Nếu chưa có, tạo mới
    if (!company) {
      company = new CongTy({
        Ten: "CÔNG TY TNHH TÂN DENTAL",
      });
      await company.save();
    }

    res.json({
      message: "Lấy thông tin công ty thành công",
      data: company,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Cập nhật thông tin công ty
exports.updateCompany = async (req, res) => {
  try {
    const { Ten, GioiThieu, Website, Email, DienThoai, DiaChi, Avatar } = req.body;

    let company = await CongTy.findOne({ isActive: true });

    // Nếu chưa có, tạo mới
    if (!company) {
      company = new CongTy({
        Ten: Ten || "CÔNG TY TNHH TÂN DENTAL",
        GioiThieu: GioiThieu || "",
        Website: Website || "",
        Email: Email || "",
        DienThoai: DienThoai || "",
        DiaChi: DiaChi || "",
        Avatar: Avatar || "",
      });
    } else {
      // Cập nhật các field
      if (Ten) company.Ten = Ten;
      if (GioiThieu !== undefined) company.GioiThieu = GioiThieu;
      if (Website !== undefined) company.Website = Website;
      if (Email !== undefined) company.Email = Email;
      if (DienThoai !== undefined) company.DienThoai = DienThoai;
      if (DiaChi !== undefined) company.DiaChi = DiaChi;
      if (Avatar !== undefined) company.Avatar = Avatar;
    }

    await company.save();

    res.json({
      message: "Cập nhật thông tin công ty thành công",
      data: company,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

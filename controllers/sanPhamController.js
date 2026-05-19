const SanPham = require("../models/SanPham");

const normalizeBaoHanhMacDinh = (value) => {
    if (value === null || value === undefined || value === "") {
        return value;
    }
    if (typeof value === "number") {
        return value;
    }
    if (typeof value === "string") {
        const normalized = value.replace(/[^0-9.]/g, "").trim();
        if (normalized === "") {
            return 0;
        }
        const numberValue = Number(normalized);
        return Number.isNaN(numberValue) ? value : numberValue;
    }
    return value;
};

// Thêm sản phẩm mới
exports.createSanPham = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            baoHanhMacDinh: normalizeBaoHanhMacDinh(req.body.baoHanhMacDinh),
        };

        const data = await SanPham.create(payload);
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Lấy danh sách sản phẩm
exports.getAllSanPham = async (req, res) => {
    try {
        const data = await SanPham.find();
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Cập nhật thông tin sản phẩm
exports.updateSanPham = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            baoHanhMacDinh: normalizeBaoHanhMacDinh(req.body.baoHanhMacDinh),
        };

        const data = await SanPham.findByIdAndUpdate(req.params.id, payload, {
            new: true,
            runValidators: true,
        });

        if (!data) {
            return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Xóa sản phẩm
exports.deleteSanPham = async (req, res) => {
    try {
        const data = await SanPham.findByIdAndDelete(req.params.id);

        if (!data) {
            return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }

        res.json({ message: "Đã xóa sản phẩm thành công" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
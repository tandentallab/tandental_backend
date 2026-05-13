const SanPham = require("../models/SanPham");

// Thêm sản phẩm mới
exports.createSanPham = async (req, res) => {
    try {
        const data = await SanPham.create(req.body);
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
        const data = await SanPham.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
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
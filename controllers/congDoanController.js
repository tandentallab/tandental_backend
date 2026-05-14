const CongDoan = require("../models/CongDoan");

// Thêm công đoạn mới vào kho
exports.createCongDoan = async (req, res) => {
    try {
        const data = await CongDoan.create(req.body);
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Lấy danh sách tất cả công đoạn trong kho
exports.getAllCongDoan = async (req, res) => {
    try {
        const data = await CongDoan.find().sort({ createdAt: -1 });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Xóa công đoạn khỏi kho
exports.deleteCongDoan = async (req, res) => {
    try {
        await CongDoan.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa công đoạn thành công" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
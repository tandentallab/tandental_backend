const express = require("express");
const router = express.Router();
const hoaDonController = require("../controllers/hoaDonController");
const { verifyToken } = require("../middleware/authMiddleware");

/* ================= QUẢN TRỊ (ADMIN) ================= */

// Lấy tất cả hóa đơn (Admin) - Hỗ trợ phân trang, lọc, tìm kiếm
router.get("/all", hoaDonController.getAllHoaDonAdmin);


/* ================= NGHIỆP VỤ HÓA ĐƠN ================= */

// Tạo hóa đơn mới
router.post("/", hoaDonController.createHoaDon);

// Lấy hóa đơn chưa thanh toán theo nha khoa (dùng cho modal phiếu thu)
router.get(
  "/chua-thanh-toan/:nhaKhoaId",
  hoaDonController.getHoaDonChuaThanhToanByNhaKhoa
);

router.get(
  "/thong-ke-cong-no",
  hoaDonController.thongKeCongNoHoaDon
);

router.get(
  "/count-don-hang-chua-xuat",
  hoaDonController.countDonHangChuaXuatHoaDonAll
);

router.get("/ngay-gan-nhat-all", hoaDonController.getNgayXuatHoaDonGanNhatAll);

// Nha khoa chưa từng có hóa đơn (?ids=a,b,c) — dùng để hỏi cập nhật bảng giá riêng
router.get("/nha-khoa-chua-co-hoa-don", verifyToken, hoaDonController.getNhaKhoaChuaCoHoaDon);


// Lấy danh sách hóa đơn theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", hoaDonController.getAllHoaDon);


router.get("/:id", hoaDonController.getHoaDonById);

// Lấy đơn hàng chưa xuất hóa đơn (Hỗ trợ lọc theo tuNgay và denNgay qua query)
router.get(
  "/don-hang-chua-xuat/:nhaKhoaId",
  hoaDonController.getDonHangChuaXuatHoaDon
);


// Cập nhật hóa đơn & Thanh toán (Sử dụng daThanhToan để cập nhật số dư)
router.put("/:id", hoaDonController.updateHoaDon);

// Thanh toán hóa đơn (partial payment)
router.post("/:id/thanh-toan", hoaDonController.thanhToanHoaDon);

router.delete("/:id", hoaDonController.deleteHoaDon);


module.exports = router;
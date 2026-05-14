const express = require("express");
const router = express.Router();
const hoaDonController = require("../controllers/hoaDonController");
const { verifyToken, authorizeRoles, APP_ROLES } = require("../middleware/authMiddleware");

const allowAdminAndKeToan = authorizeRoles(APP_ROLES.ADMIN, APP_ROLES.KE_TOAN);

/* ================= QUẢN TRỊ (ADMIN) ================= */

// Lấy tất cả hóa đơn (Admin) - Hỗ trợ phân trang, lọc, tìm kiếm
router.get("/all", verifyToken, allowAdminAndKeToan, hoaDonController.getAllHoaDonAdmin);


/* ================= NGHIỆP VỤ HÓA ĐƠN ================= */

// Tạo hóa đơn mới
router.post("/", verifyToken, allowAdminAndKeToan, hoaDonController.createHoaDon);

// Lấy hóa đơn chưa thanh toán theo nha khoa (dùng cho modal phiếu thu)
router.get(
  "/chua-thanh-toan/:nhaKhoaId",
  verifyToken,
  allowAdminAndKeToan,
  hoaDonController.getHoaDonChuaThanhToanByNhaKhoa
);
router.get(
  "/thong-ke-cong-no",
  verifyToken,
  allowAdminAndKeToan,
  hoaDonController.thongKeCongNoHoaDon
);

router.get(
  "/count-don-hang-chua-xuat",
  verifyToken,
  allowAdminAndKeToan,
  hoaDonController.countDonHangChuaXuatHoaDonAll
);

// Lấy đơn hàng chưa xuất hóa đơn - tất cả nha khoa (PHẢI ĐẶT TRƯỚC :nhaKhoaId)
router.get(
  "/don-hang-chua-xuat/all",
  verifyToken,
  allowAdminAndKeToan,
  hoaDonController.getDonHangChuaXuatHoaDonAll
);

// Lấy danh sách hóa đơn theo nha khoa
router.get("/nha-khoa/:nhaKhoaId", verifyToken, allowAdminAndKeToan, hoaDonController.getAllHoaDon);

// Lấy đơn hàng chưa xuất hóa đơn - nha khoa cụ thể
router.get(
  "/don-hang-chua-xuat/:nhaKhoaId",
  verifyToken,
  allowAdminAndKeToan,
  hoaDonController.getDonHangChuaXuatHoaDon
);


// Cập nhật hóa đơn & Thanh toán (Sử dụng daThanhToan để cập nhật số dư)
router.put("/:id", verifyToken, allowAdminAndKeToan, hoaDonController.updateHoaDon);

// Thanh toán hóa đơn (partial payment)
router.post("/:id/thanh-toan", verifyToken, allowAdminAndKeToan, hoaDonController.thanhToanHoaDon);

router.delete("/:id", verifyToken, allowAdminAndKeToan, hoaDonController.deleteHoaDon)


module.exports = router;
/**
 * Script: fixTrangThaiDangThu.js
 * Mục đích:
 *   1. Backup toàn bộ collection donhangs ra file JSON
 *   2. Cập nhật trangThai đúng theo logic yeuCauThu:
 *      - Có ít nhất 1 sản phẩm với yeuCauThu không rỗng → "Đang thử"
 *      - trangThai = "Đang thử" nhưng không còn yeuCauThu nào → "Chờ xử lý"
 *      - "Hoàn thành" / "Đã giao" → giữ nguyên
 *
 * Chạy: node scripts/fixTrangThaiDangThu.js
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const DonHang = require("../models/DonHang");

const BACKUP_DIR = path.join(__dirname, "backups");
const BACKUP_FILE = path.join(
    BACKUP_DIR,
    `donhangs_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Kết nối MongoDB thành công");

    // ── 1. BACKUP ──────────────────────────────────────────────────────────────
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const allDonHang = await DonHang.find({}).lean();
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(allDonHang, null, 2), "utf8");
    console.log(`📦 Đã backup ${allDonHang.length} đơn hàng → ${BACKUP_FILE}`);

    // ── 2. XÁC ĐỊNH CÁC ĐƠN CẦN CẬP NHẬT ─────────────────────────────────────
    const FINAL_STATUSES = ["Hoàn thành", "Đã giao"];

    let setDangThu = 0;
    let setChoXuLy = 0;
    const errors = [];

    for (const dh of allDonHang) {
        if (FINAL_STATUSES.includes(dh.trangThai)) continue;

        const hasYeuCauThu = (dh.danhSachSanPham || []).some(
            (sp) => Array.isArray(sp.yeuCauThu) && sp.yeuCauThu.length > 0
        );

        let newTrangThai = null;

        if (hasYeuCauThu && dh.trangThai !== "Đang thử") {
            newTrangThai = "Đang thử";
        } else if (!hasYeuCauThu && dh.trangThai === "Đang thử") {
            newTrangThai = "Chờ xử lý";
        }

        if (!newTrangThai) continue;

        try {
            await DonHang.updateOne(
                { _id: dh._id },
                {
                    $set: { trangThai: newTrangThai },
                    $push: {
                        nhatKyChinhSua: {
                            nguoiThuc: "System Migration",
                            hanhDong: `Cập nhật trạng thái từ "${dh.trangThai}" → "${newTrangThai}" (fix yeuCauThu)`,
                            thoiGian: new Date(),
                        },
                    },
                }
            );

            if (newTrangThai === "Đang thử") {
                setDangThu++;
                console.log(`  → [${dh.maDonHang}] ${dh.trangThai} → Đang thử`);
            } else {
                setChoXuLy++;
                console.log(`  → [${dh.maDonHang}] ${dh.trangThai} → Chờ xử lý`);
            }
        } catch (err) {
            errors.push({ id: dh._id, maDonHang: dh.maDonHang, err: err.message });
        }
    }

    // ── 3. KẾT QUẢ ────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════");
    console.log(`✅ Cập nhật thành "Đang thử"  : ${setDangThu} đơn`);
    console.log(`✅ Cập nhật thành "Chờ xử lý" : ${setChoXuLy} đơn`);
    if (errors.length) {
        console.log(`❌ Lỗi: ${errors.length} đơn`);
        errors.forEach((e) => console.log(`   - ${e.maDonHang} (${e.id}): ${e.err}`));
    }
    console.log("══════════════════════════════════════════════");

    await mongoose.disconnect();
    console.log("🔌 Ngắt kết nối MongoDB");
}

main().catch((err) => {
    console.error("❌ Lỗi không mong đợi:", err);
    process.exit(1);
});

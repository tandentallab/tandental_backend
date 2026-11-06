// Lấy chi phí lương từ CRM (GET /api/tich-hop/chi-phi-luong).
// Cấu hình bằng CRM_API_URL + CRM_API_KEY (trùng LAB_API_KEY bên CRM).

const CRM_TIMEOUT_MS = 8000;

// Trả về null khi chưa cấu hình CRM hoặc CRM chưa có kỳ lương của tháng này —
// nơi gọi dùng lại dữ liệu BangLuong cũ. Lỗi kết nối/xác thực thì ném lỗi.
const layChiPhiLuongTuCrm = async (thang, nam) => {
  const { CRM_API_URL, CRM_API_KEY } = process.env;
  if (!CRM_API_URL || !CRM_API_KEY) return null;

  const period = `${nam}-${String(thang).padStart(2, "0")}`;
  const url = new URL("/api/tich-hop/chi-phi-luong", CRM_API_URL);
  url.searchParams.set("period", period);

  const response = await fetch(url, {
    headers: { "x-api-key": CRM_API_KEY },
    signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`CRM trả về lỗi ${response.status}`);
  }
  return response.json();
};

module.exports = { layChiPhiLuongTuCrm };

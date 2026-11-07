// Gửi nha khoa sang CRM (POST /api/tich-hop/nha-khoa), chỉ gồm id và tên.
// Cấu hình bằng CRM_API_URL + CRM_API_KEY (trùng LAB_API_KEY bên CRM).

const CRM_TIMEOUT_MS = 30000;

// Trả về { daTao, boQua }, hoặc null nếu chưa cấu hình CRM. CRM tự bỏ qua nha
// khoa đã có nên gửi lại nhiều lần vẫn an toàn.
const guiNhaKhoaSangCrm = async (danhSachNhaKhoa) => {
  const { CRM_API_URL, CRM_API_KEY } = process.env;
  if (!CRM_API_URL || !CRM_API_KEY) return null;

  const nhaKhoa = danhSachNhaKhoa
    .filter((nk) => nk.hoVaTen?.trim())
    .map((nk) => ({ id: nk._id.toString(), ten: nk.hoVaTen }));
  if (nhaKhoa.length === 0) return { daTao: 0, boQua: 0 };

  const response = await fetch(new URL("/api/tich-hop/nha-khoa", CRM_API_URL), {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": CRM_API_KEY },
    body: JSON.stringify({ nhaKhoa }),
    signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`CRM trả về lỗi ${response.status}`);
  }
  return response.json();
};

module.exports = { guiNhaKhoaSangCrm };

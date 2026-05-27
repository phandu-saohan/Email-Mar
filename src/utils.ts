export function getApiUrl(path: string): string {
  try {
    // Allow manual override via localStorage (for custom backend deployments)
    const customUrl = localStorage.getItem("api_backend_url");
    if (customUrl && customUrl.trim()) {
      const origin = customUrl.trim().replace(/\/$/, "");
      return `${origin}${path}`;
    }
  } catch (e) {
    console.warn("Lỗi đọc api_backend_url từ localStorage:", e);
  }
  // On Vercel: frontend & backend share the same domain → use relative path (no CORS)
  // On local dev: vite proxy or same Express server → relative path also works
  return path;
}

export async function handleApiResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    // Attempt decoding
    return JSON.parse(text);
  } catch (error) {
    if (text.trim().startsWith("<") || text.trim().startsWith("The page") || text.toLowerCase().includes("<!doctype html>")) {
      throw new Error(`⚠️ Cổng kết nối API lỗi: Trang web không tìm thấy API hoặc phản hồi trang HTML thay thế (Lỗi 404).\n\nHướng giải quyết:\n1. Di chuyển sang Tab "Cấu hình SMTP".\n2. Cấu hình đúng "Đích kết nối API Backend" trỏ trực tiếp về máy chủ dồi dào Cloud Run.\n3. Nếu chạy trên Vercel, hãy đảm bảo Cloud Run Backend hoạt động ổn định.\n\nMã nguồn HTML phản hồi: ${text.slice(0, 120)}...`);
    }
    throw new Error(`Không thể giải mã dữ liệu JSON từ máy chủ: ${text.slice(0, 150)}...\nLỗi phân tích: ${error instanceof Error ? error.message : String(error)}`);
  }
}

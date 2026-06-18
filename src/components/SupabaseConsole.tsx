import React, { useState, useEffect, useRef } from "react";
import { getApiUrl } from "../utils";
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Copy, 
  RefreshCw, 
  ExternalLink,
  HelpCircle,
  Clock,
  ArrowRight,
  Image as ImageIcon,
  Upload,
  X,
  FileImage,
  Trash2,
  Check,
  Code
} from "lucide-react";

interface SupabaseStatus {
  isConfigured: boolean;
  supabaseUrl: string;
  tableExists: boolean;
  statusMessage: string;
  errorMessage?: string;
  schemaSql: string;
}

interface UploadedImage {
  url: string;
  name: string;
  date: string;
  size?: string;
}

export function SupabaseConsole() {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Custom states for Supabase Storage Upload Module
  const [consoleTab, setConsoleTab] = useState<"database" | "storage">("database");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>(() => {
    try {
      const saved = localStorage.getItem("supabase_uploaded_images");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFileBase64, setSelectedFileBase64] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileType, setSelectedFileType] = useState("");
  const [selectedFileSizeStr, setSelectedFileSizeStr] = useState("");
  const [copyStates, setCopyStates] = useState<Record<string, "url" | "html" | "none">>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(getApiUrl("/api/supabase/status"));
      const data = await response.json();
      setStatus(data);
    } catch (e) {
      console.error("Failed to read Supabase status:", e);
    } finally {
      setLoading(false);
    }
  };

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(getApiUrl("/api/supabase/refresh"), { method: "POST" });
      const data = await response.json();
      if (status) {
        setStatus({
          ...status,
          tableExists: data.tableExists,
          statusMessage: data.statusMessage,
          errorMessage: data.errorMessage
        });
      } else {
        await fetchStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const copySql = () => {
    if (!status) return;
    navigator.clipboard.writeText(status.schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const notifyCopy = (url: string, type: "url" | "html") => {
    const textToCopy = type === "url" ? url : `<img src="${url}" alt="Banner Ads" style="max-width: 100%; height: auto; border-radius: 8px;" />`;
    navigator.clipboard.writeText(textToCopy);
    setCopyStates(prev => ({ ...prev, [url]: type }));
    setTimeout(() => {
      setCopyStates(prev => ({ ...prev, [url]: "none" }));
    }, 2050);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const saveImagesToLocal = (images: UploadedImage[]) => {
    setUploadedImages(images);
    try {
      localStorage.setItem("supabase_uploaded_images", JSON.stringify(images));
    } catch (e) {
      console.error("Save image history failed:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Chỉ chấp nhận các tệp tin định dạng hình ảnh (png, jpg, jpeg, gif, webp).");
      return;
    }

    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 5) {
      setUploadError("Dung lượng tập tin vượt quá giới hạn khuyến nghị 5MB.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setSelectedFileName(file.name);
    setSelectedFileType(file.type);
    setSelectedFileSizeStr(`${sizeInMB.toFixed(2)} MB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedFileBase64(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    if (!selectedFileBase64) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const response = await fetch(getApiUrl("/api/supabase/upload-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: selectedFileBase64,
          fileName: `stored_${Date.now()}_${selectedFileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
          contentType: selectedFileType
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const newItem: UploadedImage = {
          url: data.imageUrl,
          name: selectedFileName,
          date: new Date().toISOString(),
          size: selectedFileSizeStr
        };
        const updated = [newItem, ...uploadedImages];
        saveImagesToLocal(updated);
        
        setUploadSuccess("✓ Đã tải ảnh lên Supabase Storage thành công! Đường dẫn ảnh (URL) đã sẵn sàng.");
        setSelectedFileBase64(null);
        setSelectedFileName("");
        setSelectedFileSizeStr("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadError(data.error || "Không thể tải lên hình ảnh. Hãy kiểm tra phân quyền Supabase Storage.");
      }
    } catch (err: any) {
      setUploadError(`Lỗi kết nối máy chủ: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeHistoryItem = (urlToDelete: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa bản ghi lịch sử này? Điều này không xóa ảnh trên Supabase nhưng sẽ ẩn liên kết khỏi lịch sử trình duyệt.")) {
      const filtered = uploadedImages.filter(img => img.url !== urlToDelete);
      saveImagesToLocal(filtered);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm flex flex-col items-center justify-center py-16 space-y-4">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">Đang tải chẩn đoán kết nối Supabase...</p>
      </div>
    );
  }

  const isConfigured = status?.isConfigured || false;
  const tableExists = status?.tableExists || false;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      
      {/* Banner Header */}
      <div className="bg-slate-900 text-white p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shadow-inner">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Kênh Quản Trị Đám Mây Supabase Pro</h2>
            <p className="text-xs text-slate-450 mt-1">
              Đồng bộ hóa dữ liệu gửi thư và trực tiếp quản lý kho lưu trữ hình ảnh tiếp thị tiếp thị của bạn.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {consoleTab === "database" && (
            <button
              onClick={triggerRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-bold rounded-xl border border-slate-700 text-slate-300 transition shrink-0 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Kiểm tra lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Sub Tab Navigation */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
        <button
          type="button"
          onClick={() => setConsoleTab("database")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition ${
            consoleTab === "database"
              ? "bg-white text-indigo-650 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Cấu hình Cơ sở dữ liệu (Database SQL)</span>
        </button>
        <button
          type="button"
          onClick={() => setConsoleTab("storage")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition ${
            consoleTab === "storage"
              ? "bg-white text-indigo-650 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
          }`}
        >
          <ImageIcon className="h-4 w-4 text-emerald-600" />
          <span>Kho lưu trữ hình ảnh (Supabase Storage)</span>
          {uploadedImages.length > 0 && (
            <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {uploadedImages.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-6 md:p-8 space-y-6">

        {consoleTab === "database" ? (
          <>
            {/* 2 Grid cards for status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Status block 1: Config check */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                isConfigured 
                  ? "bg-emerald-50/40 border-emerald-100" 
                  : "bg-amber-50/40 border-amber-100"
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Thông số môi trường</p>
                    <h3 className="text-sm font-bold text-slate-800 mt-1">Cấu hình API Credentials</h3>
                  </div>
                  {isConfigured ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-250">
                      ĐÃ THIẾT LẬP
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-amber-100 text-amber-800 border border-amber-250">
                      SANDBOX MODE (IN-MEMORY)
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 space-y-1.5">
                  {isConfigured ? (
                    <>
                      <p className="font-semibold text-slate-700">✓ Tìm thấy tham số kết nối Supabase:</p>
                      <p className="font-mono text-[11px] bg-slate-100 px-2 py-1.5 rounded select-all break-all text-slate-600 border border-slate-200">
                        {status?.supabaseUrl}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-amber-800 font-bold">Hệ thống đang mô phỏng tạm thời trong RAM</p>
                      <p className="text-slate-455 text-[11px] leading-relaxed">
                        Mọi chiến dịch tiếp thị sẽ bị mất khi máy chủ restart. Để lưu dữ liệu vĩnh viễn và upload hình ảnh, vui lòng thêm hai khóa bảo mật sau vào thư mục <code>.env.example</code> và mục <strong>Settings &gt; Secrets</strong> trên AI Studio:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] font-mono font-bold text-slate-600">
                        <li>SUPABASE_URL</li>
                        <li>SUPABASE_KEY</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>

              {/* Status block 2: Table existence */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                !isConfigured
                  ? "bg-slate-50/60 border-slate-150 text-slate-400"
                  : tableExists 
                    ? "bg-emerald-50/40 border-emerald-100" 
                    : "bg-rose-50/40 border-rose-100"
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Trạng thái Cơ sở dữ liệu</p>
                    <h3 className="text-sm font-bold text-slate-800 mt-1">Bảng dữ liệu "campaigns"</h3>
                  </div>
                  {!isConfigured ? (
                    <span className="text-[10px] font-semibold text-slate-400">Chưa kích hoạt</span>
                  ) : tableExists ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-250">
                      ● LIVE & READY
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-rose-100 text-rose-800 border border-rose-250 animate-pulse">
                      CHƯA CÓ BẢNG
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500">
                  {!isConfigured ? (
                    <p className="text-slate-400 italic">Vui lòng cấu hình Credentials để kích hoạt kiểm tra bảng.</p>
                  ) : tableExists ? (
                    <div className="space-y-1">
                      <p className="text-emerald-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        Đồng bộ hóa đám mây sẵn sàng!
                      </p>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Mọi thiết lập, email mở và click, thống kê chiến dịch đã tự động lưu trữ an toàn trong Supabase SQL Server.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-rose-800 font-extrabold flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        Không tìm thấy cấu trúc bảng SQL
                      </p>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Client Supabase đã kết nối thành công, nhưng cơ sở dữ liệu của bạn chưa có bảng <strong>campaigns</strong>. Tiến trình đang tạm fallback về in-memory.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Big Step-by-step SQL Runner Guide if not set or table missing */}
            <div className="p-6 rounded-2xl border border-slate-150 bg-slate-50 space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2.5 bg-indigo-650 text-white rounded-lg text-[10px] font-black">HƯỚNG DẪN THIẾT LẬP THẬT</span>
                <span className="text-xs text-slate-500 font-bold font-mono">Chỉ mất 1 phút</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <span className="w-5 h-5 bg-slate-200 text-slate-800 text-[10px] font-black rounded-full flex items-center justify-center">1</span>
                    <span>Copy đoạn mã SQL</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                    Copy đoạn code khởi tạo bảng <code>campaigns</code> bên dưới bằng nút "Sao chép".
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <span className="w-5 h-5 bg-slate-200 text-slate-800 text-[10px] font-black rounded-full flex items-center justify-center">2</span>
                    <span>Vào Supabase SQL Editor</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                    Mở bảng điều khiển Supabase của bạn, chọn danh mục <strong>SQL Editor</strong> ở thanh menu bên trái.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <span className="w-5 h-5 bg-slate-200 text-slate-800 text-[10px] font-black rounded-full flex items-center justify-center">3</span>
                    <span>Dán & Run SQL</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                    Chọn click <strong>"New Query"</strong>, dán đoạn mã vừa copy và bấm nút <strong>Run</strong> để tạo bảng!
                  </p>
                </div>
              </div>
            </div>

            {/* Code Block Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 font-mono">
                  <Terminal className="h-4 w-4 text-slate-400" />
                  SQL Schema Query
                </span>
                <button
                  onClick={copySql}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-250 shadow-sm"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-550" />
                  <span>{copied ? "Đã sao chép! ✓" : "Sao chép SQL"}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed rounded-2xl overflow-x-auto border border-slate-800 max-h-[220px] select-all">
                {status?.schemaSql}
              </pre>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {!isConfigured && (
              <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>Tính năng upload ảnh yêu cầu kết nối Supabase Storage thực tế</span>
                </div>
                <p className="text-[11px] leading-relaxed pl-7">
                  Vui lòng cập nhật đầy đủ biến môi trường <code>SUPABASE_URL</code> và <code>SUPABASE_KEY</code> vào mục <strong>Settings &gt; Secrets</strong> trên AI Studio thì mới có quyền ghi dữ liệu ảnh lên đám mây. Hiện tại bạn vẫn có thể tự soạn tin bằng cách kéo thả ảnh lưu trữ dạng nhúng Base64 nội bộ trong editor (dung lượng thư sẽ lớn hơn).
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* UPLOADER CONTROLS (GRID SPAN 5) */}
              <div className="md:col-span-5 bg-slate-50/50 rounded-2xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Tải hình ảnh tiếp thị mới</h3>
                
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white p-6 rounded-xl cursor-pointer text-center transition flex flex-col items-center justify-center space-y-2.5 shadow-sm"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                  <Upload className="h-8 w-8 text-indigo-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-850">Chọn ảnh từ máy tính / thiết bị</p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">JPG, PNG, GIF, WEBP dưới 5MB</span>
                  </div>
                </div>

                {selectedFileBase64 && (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        <img src={selectedFileBase64} className="object-contain w-full h-full" alt="Local preview" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{selectedFileName}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{selectedFileSizeStr}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFileBase64(null);
                          setSelectedFileName("");
                          setSelectedFileSizeStr("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="p-1 hover:bg-rose-50 rounded text-rose-600 transition"
                        title="Hủy bỏ"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleUploadImage}
                      disabled={isUploading || !isConfigured}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 text-white text-xs font-bold rounded-lg transition shadow-md shadow-indigo-100"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Đang tải lên Storage...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>Tải Lên Supabase Storage Ngay</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-250 text-rose-800 text-[11px] leading-normal font-medium flex gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      {uploadError}
                    </div>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-800 text-[11px] leading-normal font-medium flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      {uploadSuccess}
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl space-y-1.5 text-[10px] text-slate-500 leading-normal">
                  <p className="font-bold text-slate-700">📌 Hướng dẫn cơ cấu Supabase Storage:</p>
                  <p>Hệ thống tự động đồng bộ ảnh vào Bucket tên là <code>images</code>.</p>
                  <p>Nếu gặp lỗi phân quyền, bạn hãy mở Supabase Console &gt; Storage &gt; tạo một Bucket mới bật công khai (Public) mang tên <code>images</code> và thiết lập <strong>Policy: Allow upload / select for anon/authenticated roles.</strong></p>
                </div>
              </div>

              {/* FILE LIST AND TOOLS (GRID SPAN 7) */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Lịch sử ảnh đã upload ({uploadedImages.length})</h3>
                  {uploadedImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Xóa toàn bộ lịch sử hiển thị trên trình duyệt này? (Ảnh thực tế vẫn còn trên đám mây)")) {
                          saveImagesToLocal([]);
                        }
                      }}
                      className="text-[10px] text-rose-600 hover:underline font-bold"
                    >
                      Xóa tất cả lịch sử
                    </button>
                  )}
                </div>

                {uploadedImages.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                    <FileImage className="h-10 w-10 text-slate-300 mx-auto animate-bounce" />
                    <p className="text-xs font-bold text-slate-750 mt-3">Chưa có hình ảnh nào trong lịch sử tủ đồ</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      Hãy tải một chiếc ảnh ở hộp bên trái. Đường dẫn trực tuyến sẽ tự động được ghi nhận tại đây để bạn sao chép và dán nhanh vào email tiếp thị của mình bất kỳ lúc nào!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {uploadedImages.map((image, index) => {
                      const copyState = copyStates[image.url] || "none";
                      return (
                        <div key={index} className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex gap-3 shadow-xs items-center transition hover:shadow-sm">
                          <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-150 overflow-hidden shrink-0 flex items-center justify-center bg-slate-100">
                            <img src={image.url} className="object-cover w-full h-full" alt={image.name} onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=CORS/Error";
                            }} />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs font-bold text-slate-800 truncate" title={image.name}>{image.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="font-mono">{image.size || "Unknown size"}</span>
                              <span>•</span>
                              <span>{new Date(image.date).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => notifyCopy(image.url, "url")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-750 rounded-lg transition"
                              title="Sao chép đường dẫn ảnh trực tuyến"
                            >
                              {copyState === "url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              <span>{copyState === "url" ? "Đã copy!" : "Copy Link"}</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => notifyCopy(image.url, "html")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-750 rounded-lg transition"
                              title="Sao chép thẻ mã nhúng HTML <img>"
                            >
                              {copyState === "html" ? <Check className="h-3 w-3" /> : <Code className="h-3 w-3" />}
                              <span>{copyState === "html" ? "Đã html!" : "Copy HTML"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => removeHistoryItem(image.url)}
                              className="p-1 px-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition"
                              title="Ẩn lịch sử ghi nhận"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Footer info link */}
        <div className="text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-100 gap-2">
          <span className="flex items-center gap-1">
            <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
            Vạn vật liên lạc và đồng bộ tự động qua cổng bảo mật SSL/TLS.
          </span>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-indigo-600 font-bold hover:underline"
          >
            Đến Supabase Console <ExternalLink className="h-3 w-3" />
          </a>
        </div>

      </div>
    </div>
  );
}

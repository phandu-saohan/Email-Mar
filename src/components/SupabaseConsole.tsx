import React, { useState, useEffect } from "react";
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
  ArrowRight
} from "lucide-react";

interface SupabaseStatus {
  isConfigured: boolean;
  supabaseUrl: string;
  tableExists: boolean;
  statusMessage: string;
  errorMessage?: string;
  schemaSql: string;
}

export function SupabaseConsole() {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/supabase/status");
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
      const response = await fetch("/api/supabase/refresh", { method: "POST" });
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

  useEffect(() => {
    fetchStatus();
  }, []);

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
      <div className="bg-slate-900 text-white p-6 md:p-8 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Cấu hình Cơ sở dữ liệu Supabase (Live)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Đồng bộ hóa các chiến dịch, danh sách khách hàng và nhật ký gửi email lên đám mây real-time.
            </p>
          </div>
        </div>
        <button
          onClick={triggerRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-bold rounded-lg border border-slate-700 text-slate-300 transition shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>Kiểm tra lại</span>
        </button>
      </div>

      <div className="p-6 md:p-8 space-y-6">

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
                  <p className="font-mono text-[11px] bg-slate-100 px-2 py-1 rounded select-all break-all text-slate-550 border border-slate-200">
                    {status?.supabaseUrl}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-amber-800 font-bold">Hệ thống đang chạy trên RAM và biến tạm thời</p>
                  <p className="text-slate-450 text-[11px] leading-relaxed">
                    Mọi chiến dịch sẽ bị mất khi máy chủ restart. Để lưu trữ dữ liệu vĩnh viễn, hãy thêm hai khóa bảo mật sau vào thư mục <strong>.env.example</strong> và vào mục <strong>Settings &gt; Secrets</strong> trên AI Studio:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] font-mono font-semibold text-slate-600">
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
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Đồng bộ hóa đám mây sẵn sàng!
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Mọi thiết lập, email mở và click, thống kê chiến dịch đã tự động lưu trữ an toàn trong Supabase SQL Server.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-rose-800 font-extrabold flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
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
            <span className="p-1 px-2.5 bg-indigo-650 text-white rounded-lg text-xs font-black">HƯỚNG DẪN THIẾT LẬP THẬT</span>
            <span className="text-xs text-slate-500 font-bold font-mono">Chỉ mất 1 phút</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <span className="w-5 h-5 bg-slate-250 text-slate-800 text-[10px] font-black rounded-full flex items-center justify-center">1</span>
                <span>Copy đoạn mã SQL</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                Copy đoạn code khởi tạo bảng <code>campaigns</code> bên dưới bằng nút "Sao chép".
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <span className="w-5 h-5 bg-slate-250 text-slate-800 text-[10px] font-black rounded-full flex items-center justify-center">2</span>
                <span>Vào Supabase SQL Editor</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                Mở bảng điều khiển Supabase của bạn, chọn danh mục <strong>SQL Editor</strong> ở thanh menu bên trái.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <span className="w-5 h-5 bg-slate-250 text-slate-800 text-[10px] font-black rounded-full flex items-center justify-center">3</span>
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
              className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-250 shadow-xs"
            >
              <Copy className="h-3.5 w-3.5 text-slate-550" />
              <span>{copied ? "Đã sao chép! ✓" : "Sao chép SQL"}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed rounded-2xl overflow-x-auto border border-slate-800 max-h-[220px] select-all">
            {status?.schemaSql}
          </pre>
        </div>

        {/* Footer info link */}
        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
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

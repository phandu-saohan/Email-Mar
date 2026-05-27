import React, { useState } from "react";
import { SmtpConfig } from "../types";
import { Server, ShieldCheck, Mail, User, Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Clock, Sparkles, Link2 } from "lucide-react";
import { getApiUrl } from "../utils";

interface SmtpSettingsProps {
  smtpConfig: SmtpConfig | null;
  onSave: (config: SmtpConfig | null) => void;
}

export function SmtpSettings({ smtpConfig, onSave }: SmtpSettingsProps) {
  const [host, setHost] = useState(smtpConfig?.host || "smtp.gmail.com");
  const [port, setPort] = useState(smtpConfig?.port || 465);
  const [secure, setSecure] = useState(smtpConfig?.secure ?? true);
  const [user, setUser] = useState(smtpConfig?.user || "");
  const [pass, setPass] = useState(smtpConfig?.pass || "");
  const [fromName, setFromName] = useState(smtpConfig?.fromName || "Phòng Marketing");
  const [fromEmail, setFromEmail] = useState(smtpConfig?.fromEmail || "");
  const [delaySeconds, setDelaySeconds] = useState(smtpConfig?.delaySeconds || 15);
  const [showPassword, setShowPassword] = useState(false);

  // API Backend URL state for deployments like Vercel
  const [apiBackendUrl, setApiBackendUrl] = useState(() => {
    try {
      const url = localStorage.getItem("api_backend_url") || "";
      // Tự động dọn dẹp URL Cloud Run cũ bị lỗi CORS
      if (url.includes("asia-southeast1.run.app") || url.includes("kfmstvnejouesdbyvqhy37")) {
        localStorage.removeItem("api_backend_url");
        return "";
      }
      return url;
    } catch {
      return "";
    }
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      host,
      port: Number(port),
      secure,
      user,
      pass,
      fromName,
      fromEmail: fromEmail || user,
      delaySeconds: Number(delaySeconds)
    });
  };

  const handleSaveApiBackend = () => {
    try {
      const url = apiBackendUrl.trim();
      if (url) {
        localStorage.setItem("api_backend_url", url);
        alert(`✓ Đã lưu cấu hình API Backend URL: ${url}\n\nHệ thống sẽ định tuyến toàn bộ yêu cầu qua cổng API này.`);
      } else {
        localStorage.removeItem("api_backend_url");
        alert("✓ Đã xóa cấu hình API Backend. Hệ thống sẽ sử dụng Relative Route mặc định.");
      }
      window.location.reload(); // Reload to apply across entire React app context
    } catch (e) {
      alert("Không thể lưu API Backend URL: " + e);
    }
  };

  const testConnection = async () => {
    if (!host || !port || !user || !pass) {
      setTestResult({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin Host, Port, Username và Mật khẩu trước khi thử nghiệm kết nối.",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const payload: SmtpConfig = {
      host,
      port: Number(port),
      secure,
      user,
      pass,
      fromName,
      fromEmail: fromEmail || user,
      delaySeconds: Number(delaySeconds)
    };

    try {
      const response = await fetch(getApiUrl("/api/campaigns/test-smtp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || "Kiểm tra kết nối và đăng nhập SMTP thành công!",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Không thể kết nối máy chủ Mail, vui lòng kiểm tra lại thông số SMTP.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Lỗi kiểm tra kết nối SMTP.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
      
      {/* Header section (strictly SMTP setup) */}
      <div className="pb-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span>⚙️ Thiết lập Cổng gửi Email SMTP Thật</span>
            <span className="text-[10px] font-black tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5">SMTP CHÍNH THỨC</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cấu hình cổng SMTP của riêng bạn để tiến hành gửi email marketing thực tế, chấm dứt hoàn toàn chế độ mô phỏng demo.
          </p>
        </div>
      </div>

      {/* Main Grid: SMTP Form & Google Safety Rules Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 cols: SMTP Setup Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Máy chủ SMTP Host</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Server className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Cổng Port</label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPort(val);
                    if (val === 465) setSecure(true);
                    else if (val === 587) setSecure(false);
                  }}
                  placeholder="465 hoặc 587"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Mã hoá SSL / TLS</label>
                <select
                  value={secure ? "true" : "false"}
                  onChange={(e) => setSecure(e.target.value === "true")}
                  className="block w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="true">SSL (Cổng 465)</option>
                  <option value="false">TLS / STARTTLS (Cổng 587)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Tên người gửi (From Name)</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Ví dụ: Công Ty TNHH Marketing"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Địa chỉ thư người gửi (From Email)</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="Để trống nếu trùng tài khoản SMTP"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Tài khoản SMTP Username</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="đăng_nhập_email_cuaban@gmail.com"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Mật khẩu ứng dụng (App Password)</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Mật khẩu 16 chữ số được Google cấp"
                  className="block w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Configurable Throttling Delay Fields */}
            <div className="md:col-span-2 p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                  <Clock className="w-4 h-4 text-amber-700" />
                  ⏳ Khoảng cách gửi trễ giữa mỗi email (Cực kì quan trọng)
                </span>
                <span className="text-xs font-extrabold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-lg">
                  {delaySeconds} giây / email
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-normal">
                Để tránh thuật toán chống spam thông minh của Google/Gmail block tài khoản, bạn phải kéo giãn tiến trình. Google sẽ nghi ngờ nếu phát hiện hàng chục Mail phóng ra cùng 1 giây. Khuyến nghị thiết lập: <strong>10 giây đến 30 giây</strong> để tạo nhịp điệu gửi hữu cơ như con người.
              </p>
              <div className="flex items-center gap-4 pt-1">
                <input
                  type="range"
                  min="2"
                  max="120"
                  step="1"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="flex-1 accent-amber-600 cursor-ew-resize"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="2"
                    max="600"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Math.max(2, Number(e.target.value)))}
                    className="w-16 px-2 py-1 border border-amber-300 rounded text-center text-xs font-extrabold bg-white text-slate-800 outline-none focus:border-amber-500"
                  />
                  <span className="text-[11px] font-bold text-amber-800">GIÂY</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl space-y-1.5">
            <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Cách cấu hình Tài khoản Gmail (App Passwords) miễn phí:
            </h4>
            <p className="text-[11px] text-indigo-850 leading-relaxed">
              Bạn không thể dùng mật khẩu đăng nhập tài khoản Gmail thông thường. Hãy thực hiện cấu hình an toàn:
              <br />
              1. Bật <strong>Xác minh 2 bước (2-Step Verification)</strong> trong Google Account Bảo mật của bạn.
              <br />
              2. Truy cập thanh tìm kiếm bảo mật, gõ <strong>"App Passwords" (Mật khẩu ứng dụng)</strong>.
              <br />
              3. Chọn tên là "Email Marketing App" để sinh mã mật khẩu bảo mật bao gồm <strong>16 ký tự viết liền</strong>. Nhập mã đó vào ô Mật khẩu ở trên, sử dụng SMTP Host <code>smtp.gmail.com</code> và Cổng <code>465</code>.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 border ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
              )}
              <div className="text-xs font-semibold leading-relaxed">{testResult.message}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 pt-4 justify-end border-t border-slate-100">
            <button
              type="button"
              disabled={testing}
              onClick={testConnection}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-705 transition border border-slate-200"
            >
              {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              {testing ? "Đang kết nối thử..." : "Kiểm tra kết nối"}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition"
            >
              Lưu cấu hình SMTP
            </button>
          </div>
        </form>

        {/* Right 1 col: Google Block Avoidance Guidelines Card */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-black tracking-wider uppercase">NGĂN CHẶN SPAM</span>
            <span className="text-[10px] text-slate-400 font-extrabold">GOOGLE SHIELD</span>
          </div>

          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">6 BƯỚC THẦN THÁNH TRÁNH BỊ GOOGLE BLOCK:</h3>

          <div className="space-y-4 text-[11px] leading-relaxed">
            
            <div className="space-y-1">
              <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-800">1</span>
                <span>Tăng trễ gửi &lt;Delay&gt;</span>
              </div>
              <p className="text-slate-500 pl-5">
                Đừng bao giờ để gửi liên tục lập tức. Hãy đặt giãn cách từ <strong>15 - 30 giây</strong> giữa mỗi người nhận để Google coi như hành vi soạn thảo gửi tự nhiên.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-800">2</span>
                <span>Cá nhân hoá triệt để</span>
              </div>
              <p className="text-slate-500 pl-5">
                Sử dụng các thẻ <code>{"{{name}}"}</code>, <code>{"{{company}}"}</code>, <code>{"{{discount}}"}</code> dồi dào để đảm bảo nội dung mỗi bức thư gửi ra là **độc bản**. Google sẽ lọc nếu phát hiện 200 email giống hệt chữ gửi đi cùng lúc.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-800">3</span>
                <span>Khởi động làm ấm (Warm-up)</span>
              </div>
              <p className="text-slate-500 pl-5">
                Nếu dùng Email mới tạo, hãy bắt đầu gửi nhỏ lẻ: Ngày 1 gửi 10 thư, Ngày 2 gửi 20, tăng dần lên tối đa 100-200 thư/ngày để xây danh tiếng địa chỉ IP/Thư tín.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-800">4</span>
                <span>Kiểm tra sạch sẽ danh sách</span>
              </div>
              <p className="text-slate-500 pl-5">
                Hãy lọc bỏ các Email lỗi hoặc không tồn tại. Nếu tỷ lệ dội thư lỗi từ máy chủ (Bounce Rate) vượt mức <strong>3%</strong>, Google sẽ lập tức dán nhãn bộ lọc thư rác (Spam Filter) lên tài khoản gửi.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-800">5</span>
                <span>Cấu hình SPF, DKIM & DMARC</span>
              </div>
              <p className="text-slate-500 pl-5">
                Nếu sử dụng Email tên miền doanh nghiệp riêng (e.g. <code>info@yourcompany.com</code>), hãy liên hệ nhà cấp Hosting để thêm cấu hình bản ghi DNS SPF/DKIM xác thực chính chủ gửi.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-800">6</span>
                <span>Tránh từ ngữ nhạy cảm Spam</span>
              </div>
              <p className="text-slate-500 pl-5">
                Hạn chế ghi các cụm từ kích thích spam như "Mua ngay lập tức", "Nhận tiền cực giàu", "Kiếm tiền miễn phí", "Cam kết 100%" ở tiêu đề lớn.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* API Backend URL integration for Vercel / External Deployments */}
      <div className="mt-8 pt-8 border-t border-slate-100 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Cấu hình Đích kết nối API Backend (Dành cho Máy chủ ngoài)</h3>
            <p className="text-[11px] text-slate-400">Hiện tại hệ thống đã chạy API Serverless trực tiếp trên Vercel, không cần cấu hình thêm.</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-normal">
            Hệ thống đã được tích hợp đầy đủ các chức năng <strong>gửi SMTP thật, sử dụng AI Gemini</strong> trực tiếp trên Vercel dưới dạng Serverless API. Bạn chỉ cần cấu hình cổng API ngoài này nếu tự chạy một máy chủ Backend riêng:
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              placeholder="Ví dụ: http://localhost:3000 hoặc URL API của bạn"
              value={apiBackendUrl}
              onChange={(e) => setApiBackendUrl(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white text-slate-800 shadow-sm"
            />
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveApiBackend}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 text-xs rounded-lg transition shadow-sm shrink-0"
              >
                💾 Lưu Cổng API Backend
              </button>
              {apiBackendUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setApiBackendUrl("");
                    localStorage.removeItem("api_backend_url");
                    alert("✓ Đã xóa cấu hình API Backend. Hệ thống sẽ sử dụng Vercel Serverless API mặc định.");
                    window.location.reload();
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-2 text-xs rounded-lg transition shrink-0"
                >
                  Xoá rỗng
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-850 leading-relaxed font-semibold">
            💡 <strong>Thông tin:</strong> Mặc định khi bỏ trống ô trên, hệ thống sẽ sử dụng Relative Route (ví dụ: <code>/api/campaigns</code>) để gọi trực tiếp các Serverless Function chạy cùng domain trên Vercel của bạn, đảm bảo hoạt động hoàn hảo 100% không bị chặn CORS.
          </div>
        </div>
      </div>

    </div>
  );
}


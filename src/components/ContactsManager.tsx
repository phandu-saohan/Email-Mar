import React, { useState, useEffect, useRef } from "react";
import { getApiUrl } from "../utils";
import { Contact } from "../types";
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Filter,
  UserCheck,
  MailWarning,
  RefreshCw,
  Sparkles
} from "lucide-react";

export function ContactsManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "bounced">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [analyzedResult, setAnalyzedResult] = useState<{
    valid: Contact[];
    duplicates: number;
    invalid: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContacts = async () => {
    try {
      const response = await fetch(getApiUrl("/api/contacts"));
      const data = await response.json();
      setContacts(data);
    } catch (e) {
      console.error("Lỗi khi tải danh bạ:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khách hàng này khỏi danh bạ?")) return;
    try {
      const response = await fetch(getApiUrl(`/api/contacts/${id}`), {
        method: "DELETE"
      });
      if (response.ok) {
        setContacts(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      alert("Lỗi khi xóa contact: " + e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("🔴 CẢNH BÁO: Bạn có chắc chắn muốn xóa SẠCH toàn bộ danh bạ khách hàng? Hành động này không thể hoàn tác!")) return;
    try {
      const response = await fetch(getApiUrl("/api/contacts/clear"), {
        method: "POST"
      });
      if (response.ok) {
        setContacts([]);
        alert("✓ Đã xóa sạch danh bạ khách hàng.");
      }
    } catch (e) {
      alert("Lỗi khi dọn dẹp danh bạ: " + e);
    }
  };

  // CSV Parser
  const parseCSVContent = (text: string): { name: string; email: string; company?: string; customFields?: Record<string, string> }[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    // Tách cột bằng dấu phẩy hoặc chấm phẩy
    const delimiter = text.includes(";") ? ";" : ",";
    
    // Đọc dòng đầu làm header để định dạng
    let headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    let emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
    let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("tên") || h.includes("ten") || h.includes("họ tên"));
    let companyIdx = headers.findIndex(h => h.includes("company") || h.includes("công ty") || h.includes("cong ty") || h.includes("doanh nghiệp"));

    const parsed: any[] = [];

    // Nếu dòng đầu có vẻ không phải header (ví dụ dòng đầu chứa email trực tiếp), ta sẽ phân tích chay
    const isFirstLineHeader = emailIdx !== -1 || nameIdx !== -1 || headers.some(h => ["name", "email", "company", "tên", "công ty"].includes(h));
    
    const startIndex = isFirstLineHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Phân tích dòng CSV xử lý dấu ngoặc kép đúng chuẩn
      const values: string[] = [];
      let insideQuote = false;
      let currentVal = "";
      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === delimiter && !insideQuote) {
          values.push(currentVal.trim().replace(/^"|"$/g, ""));
          currentVal = "";
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^"|"$/g, ""));

      let email = "";
      let name = "";
      let company = "";

      if (isFirstLineHeader) {
        if (emailIdx !== -1 && values[emailIdx]) email = values[emailIdx];
        if (nameIdx !== -1 && values[nameIdx]) name = values[nameIdx];
        if (companyIdx !== -1 && values[companyIdx]) company = values[companyIdx];
      } else {
        // Dự đoán thứ tự cột: Cột đầu là Tên, Cột hai là Email, Cột ba là Công ty
        // Hoặc tìm cột chứa ký tự '@'
        const foundEmailIdx = values.findIndex(v => v.includes("@"));
        if (foundEmailIdx !== -1) {
          email = values[foundEmailIdx];
          name = values[foundEmailIdx === 0 ? 1 : 0] || "";
          company = values[foundEmailIdx <= 1 ? 2 : 1] || "";
        } else {
          name = values[0] || "";
          email = values[1] || "";
          company = values[2] || "";
        }
      }

      if (email && email.includes("@")) {
        const customFields: Record<string, string> = {};
        if (isFirstLineHeader) {
          headers.forEach((h, idx) => {
            if (idx !== emailIdx && idx !== nameIdx && idx !== companyIdx && values[idx]) {
              customFields[h] = values[idx];
            }
          });
        }
        parsed.push({
          name: name.trim() || email.split("@")[0],
          email: email.trim().toLowerCase(),
          company: company.trim() || "",
          customFields
        });
      }
    }
    return parsed;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      analyzeImports(text);
    };
    reader.onerror = () => {
      setImportError("Không thể đọc tệp tin CSV này.");
    };
    reader.readAsText(file);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setImportText(text);
    if (text.trim()) {
      analyzeImports(text);
    } else {
      setAnalyzedResult(null);
    }
  };

  // Analyze import data for duplicate / invalid before final submit
  const analyzeImports = (text: string) => {
    try {
      const parsedRaw = parseCSVContent(text);
      if (parsedRaw.length === 0) {
        setAnalyzedResult({ valid: [], duplicates: 0, invalid: 0 });
        return;
      }

      const validList: Contact[] = [];
      let duplicates = 0;
      let invalid = 0;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      parsedRaw.forEach((c, idx) => {
        if (!c.email || !c.name || !emailRegex.test(c.email)) {
          invalid++;
          return;
        }

        // Check duplicate in imported payload
        const isDupInPayload = validList.some(item => item.email.toLowerCase() === c.email.toLowerCase());
        // Check duplicate in existing database contacts
        const isDupInDb = contacts.some(item => item.email.toLowerCase() === c.email.toLowerCase());

        if (isDupInPayload || isDupInDb) {
          duplicates++;
          return;
        }

        validList.push({
          id: `c_imp_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          email: c.email.toLowerCase(),
          name: c.name,
          company: c.company || "",
          status: "active",
          customFields: c.customFields || {},
          createdAt: new Date().toISOString()
        });
      });

      setAnalyzedResult({
        valid: validList,
        duplicates,
        invalid
      });
    } catch (err: any) {
      setImportError("Định dạng dữ liệu không hợp lệ: " + err.message);
    }
  };

  const executeImport = async () => {
    if (!analyzedResult || analyzedResult.valid.length === 0) return;

    setImporting(true);
    setImportError(null);

    try {
      const response = await fetch(getApiUrl("/api/contacts/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: analyzedResult.valid })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setContacts(data.contacts);
        alert(`✓ Nhập danh bạ thành công!\n- Đã thêm mới: ${analyzedResult.valid.length} khách nhận\n- Bỏ qua trùng lặp: ${analyzedResult.duplicates} dòng\n- Bỏ qua sai định dạng: ${analyzedResult.invalid} dòng`);
        
        // Reset states
        setImportText("");
        setImportFile(null);
        setAnalyzedResult(null);
        setShowImportModal(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setImportError(data.error || "Gặp lỗi trong quá trình đồng bộ lên máy chủ.");
      }
    } catch (e: any) {
      setImportError("Lỗi kết nối: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // Stats computation
  const totalContactsCount = contacts.length;
  const activeContactsCount = contacts.filter(c => c.status === "active" || !c.status).length;
  const bouncedContactsCount = contacts.filter(c => c.status === "bounced").length;

  // Filter & Search
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const contactStatus = c.status || "active";
    const matchesFilter = statusFilter === "all" || contactStatus === statusFilter;

    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalItems = filteredContacts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số liên hệ</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-slate-900">{totalContactsCount}</span>
              <span className="text-xs text-slate-550">người nhận</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hoạt động tốt (Active)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-emerald-700">{activeContactsCount}</span>
              <span className="text-[10px] text-emerald-600 font-bold">
                ({totalContactsCount > 0 ? Math.round((activeContactsCount / totalContactsCount) * 100) : 100}%)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl">
            <MailWarning className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email chết / Hỏng (Bounced)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-rose-700">{bouncedContactsCount}</span>
              <span className="text-[10px] text-rose-600 font-bold">
                ({totalContactsCount > 0 ? Math.round((bouncedContactsCount / totalContactsCount) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Database Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Controls Header */}
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <span>👤 Danh bạ lưu trữ trung tâm</span>
              <span className="text-[10px] font-black bg-indigo-100 text-indigo-850 px-2 py-0.5 rounded-full uppercase tracking-wider">Supabase Live</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Lưu danh sách khách hàng vĩnh viễn, lọc email trùng lặp và email hỏng tự động.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <Upload className="h-4 w-4" /> 
              <span>Tải danh sách lên (CSV/Excel)</span>
            </button>
            {contacts.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Xóa sạch danh bạ</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between bg-white">
          
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Tìm theo tên, email, công ty..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Bộ lọc:
            </span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
              <button
                onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                  statusFilter === "all" ? "bg-white text-indigo-650 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tất cả ({totalContactsCount})
              </button>
              <button
                onClick={() => { setStatusFilter("active"); setCurrentPage(1); }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                  statusFilter === "active" ? "bg-white text-emerald-650 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Hoạt động ({activeContactsCount})
              </button>
              <button
                onClick={() => { setStatusFilter("bounced"); setCurrentPage(1); }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                  statusFilter === "bounced" ? "bg-white text-rose-650 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Email chết ({bouncedContactsCount})
              </button>
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-400">Đang đồng bộ danh bạ từ đám mây...</p>
            </div>
          ) : totalItems === 0 ? (
            <div className="text-center py-16 px-6">
              <Users className="h-12 w-12 text-slate-350 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800 mt-4">Chưa có liên hệ nào thỏa mãn</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                {contacts.length === 0 
                  ? "Danh bạ khách hàng của bạn hiện đang trống rỗng. Hãy bấm 'Tải danh sách lên (CSV/Excel)' ở góc trên để bắt đầu tiếp thị."
                  : "Không tìm thấy khách hàng nào khớp với từ khóa hoặc bộ lọc của bạn."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="w-full text-left border-collapse hidden md:table">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-3 px-5">Tên khách hàng</th>
                    <th className="py-3 px-5">Địa chỉ Email</th>
                    <th className="py-3 px-5">Công ty / Tổ chức</th>
                    <th className="py-3 px-5 text-center">Trạng thái</th>
                    <th className="py-3 px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {paginatedContacts.map((c) => {
                    const isBounced = c.status === "bounced";
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-5 font-bold text-slate-800">{c.name}</td>
                        <td className="py-3.5 px-5 font-mono text-[11px] text-slate-600">{c.email}</td>
                        <td className="py-3.5 px-5 text-slate-500">{c.company || "—"}</td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            isBounced 
                              ? "bg-rose-100 text-rose-800 border border-rose-200" 
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}>
                            {isBounced ? "✗ BỊ CHẾT (BOUNCED)" : "✓ HOẠT ĐỘNG"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Xóa khách hàng"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Card-List View */}
              <div className="md:hidden divide-y divide-slate-100 bg-white">
                {paginatedContacts.map((c) => {
                  const isBounced = c.status === "bounced";
                  return (
                    <div key={c.id} className="p-4 flex flex-col gap-2.5 hover:bg-slate-50/30 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{c.name}</h4>
                          <p className="text-slate-400 text-[10px] mt-0.5">{c.company || "Không có doanh nghiệp"}</p>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          isBounced 
                            ? "bg-rose-100 text-rose-800 border border-rose-200" 
                            : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {isBounced ? "Bị chết" : "Hoạt động"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-dashed border-slate-100">
                        <span className="font-mono text-[11px] text-slate-650 truncate max-w-[75%]">{c.email}</span>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition shrink-0 border border-slate-100 hover:border-rose-100"
                          title="Xóa khách hàng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold bg-slate-50/30">
            <span>
              Hiển thị từ {(currentPage - 1) * itemsPerPage + 1} đến {Math.min(currentPage * itemsPerPage, totalItems)} trong tổng số {totalItems} liên hệ
            </span>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition flex items-center gap-0.5 bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <span className="px-3">Trang {currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 px-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition flex items-center gap-0.5 bg-slate-50"
              >
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col p-6 space-y-5 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Nhập danh sách khách hàng mới</h3>
                  <p className="text-[10px] text-slate-400">Chọn tệp CSV từ máy tính hoặc dán danh sách thô.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText("");
                  setImportFile(null);
                  setAnalyzedResult(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-455 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selector Option */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* File Uploader */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-slate-50/50 p-6 rounded-xl cursor-pointer text-center transition flex flex-col items-center justify-center space-y-2 shadow-xs"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".csv"
                />
                <Upload className="h-7 w-7 text-indigo-500" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Chọn tệp CSV (.csv)</p>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Tải file xuất từ Excel của bạn</span>
                </div>
                {importFile && (
                  <span className="inline-flex px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] rounded font-bold max-w-full truncate">
                    📎 {importFile.name}
                  </span>
                )}
              </div>

              {/* Tips block */}
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5 text-[10px] leading-relaxed text-amber-900 font-semibold flex flex-col justify-center">
                <p className="flex items-center gap-1 text-xs text-amber-800 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Cấu trúc cột file CSV gợi ý:
                </p>
                <p>Nên có cột <strong>email</strong>, <strong>name</strong> (hoặc tên), <strong>company</strong> (hoặc công ty).</p>
                <p>Các cột bổ sung như <code>discount</code>, <code>position</code> sẽ tự động được ghi vào các trường tùy chỉnh (customFields) để bạn cá nhân hóa sâu bằng thẻ <code>{"{{discount}}"}</code> trong thư.</p>
              </div>

            </div>

            {/* Custom Manual Text Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hoặc dán văn bản CSV thô:</label>
                <button
                  type="button"
                  onClick={() => {
                    const sampleText = `name,email,company\nNguyen Van A,anguyen@gmail.com,Công ty ABC\nTran Thi B,btran@yahoo.com,ABC Group`;
                    setImportText(sampleText);
                    analyzeImports(sampleText);
                  }}
                  className="text-[10px] text-indigo-600 hover:underline font-bold"
                >
                  ⚡ Dán dữ liệu mẫu để thử
                </button>
              </div>
              <textarea
                rows={5}
                placeholder="Dán nội dung văn bản CSV của bạn vào đây. Ví dụ:&#10;name,email,company&#10;Nguyen Van A,anguyen@gmail.com,Công ty ABC"
                value={importText}
                onChange={handleTextareaChange}
                className="block w-full p-3 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-350 focus:outline-none focus:border-indigo-500 bg-white text-slate-800 font-mono shadow-inner"
              />
            </div>

            {/* Diagnostics Analysis Preview */}
            {analyzedResult && (
              <div className="p-4 rounded-xl border bg-slate-50 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  🔍 Chẩn đoán & Phân tích lọc dữ liệu:
                </h4>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-500 block uppercase">Hợp lệ</span>
                    <strong className="text-lg font-black text-emerald-700">{analyzedResult.valid.length}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                    <span className="text-[10px] font-bold text-amber-500 block uppercase">Bị trùng lặp</span>
                    <strong className="text-lg font-black text-amber-700">{analyzedResult.duplicates}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-rose-100">
                    <span className="text-[10px] font-bold text-rose-500 block uppercase">Sai cấu trúc</span>
                    <strong className="text-lg font-black text-rose-700">{analyzedResult.invalid}</strong>
                  </div>
                </div>

                {analyzedResult.valid.length > 0 ? (
                  <p className="text-[10px] text-emerald-800 font-semibold leading-relaxed flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    Hệ thống sẽ lọc bỏ trùng lặp và email sai cấu trúc. Nhấn "Đồng bộ ngay" dưới đây để lưu {analyzedResult.valid.length} khách nhận vào cơ sở dữ liệu.
                  </p>
                ) : (
                  <p className="text-[10px] text-rose-800 font-semibold leading-relaxed flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    Không tìm thấy bất kỳ địa chỉ Email hợp lệ và mới nào để nhập! Vui lòng kiểm tra lại cấu trúc file.
                  </p>
                )}
              </div>
            )}

            {importError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-250 text-rose-800 text-xs font-semibold flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div>{importError}</div>
              </div>
            )}

            {/* Modal Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText("");
                  setImportFile(null);
                  setAnalyzedResult(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeImport}
                disabled={importing || !analyzedResult || analyzedResult.valid.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
              >
                {importing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{importing ? "Đang đồng bộ..." : "Đồng Bộ Ngay"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

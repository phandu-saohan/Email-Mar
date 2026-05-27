import React, { useState, useEffect, useRef } from "react";
import { getApiUrl, handleApiResponse } from "./utils";
import { Campaign, Contact, SmtpConfig, PRESET_TONES, PRESET_LANGUAGES } from "./types";
import { SmtpSettings } from "./components/SmtpSettings";
import { SupabaseConsole } from "./components/SupabaseConsole";
import { RichTextEditor } from "./components/RichTextEditor";
import { ContactsManager } from "./components/ContactsManager";
import {
  Mail,
  Users,
  Sparkles,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Plus,
  Send,
  Code,
  Eye,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Laptop,
  Phone,
  BarChart4,
  Check,
  ClipboardList,
  Terminal,
  HelpCircle,
  FileSpreadsheet,
  Upload,
  Download,
  FileText,
  Pencil,
  ChevronDown
} from "lucide-react";

// Pre-populated realistic Vietnamese marketing contacts to test instantly
const DEMO_CONTACTS: Contact[] = [
  { id: "c1", name: "Nguyễn Văn Hùng", email: "hung.nguyen.demo@gmail.com", company: "TechGroup Việt Nam", customFields: { discount: "30%", position: "Giám Đốc Công Nghệ" } },
  { id: "c2", name: "Trần Thị Minh Thư", email: "thu.tran.demo@outlook.com", company: "GreenSpace Organic", customFields: { discount: "25%", position: "Trưởng phòng Nhân Sự" } },
  { id: "c3", name: "Lê Hoàng Nam", email: "nam.le.demo@fpt.edu.vn", company: "FPT Software", customFields: { discount: "40%", position: "Developer" } },
  { id: "c4", name: "Phạm Hải Đăng", email: "dang.pham.demo@yahoo.com", company: "Đăng Quang Jewelers", customFields: { discount: "20%", position: "Quản lý Cửa Hàng" } },
  { id: "c5", name: "Vũ Khánh Linh", email: "linh.vu.demo@gmail.com", company: "Linh San Fashion", customFields: { discount: "35%", position: "Designer sành điệu" } },
  { id: "c6", name: "Hoàng Đức Anh", email: "anh.hoang.demo@vng.com.vn", company: "VNG Corporation", customFields: { discount: "15%", position: "Bộ phận Tech" } },
  { id: "c7", name: "Đặng Thùy Dương", email: "duong.dang.demo@gmail.com", company: "Dương Khuê Coffee", customFields: { discount: "50%", position: "Co-Founder kiêm Barista" } },
  { id: "c8", name: "Đỗ Gia Huy", email: "huy.do.demo@vinamilk.com", company: "Vinamilk Việt Nam", customFields: { discount: "20%", position: "Giám sát" } },
  { id: "c9", name: "Bùi Ngọc Hân", email: "han.bui.demo@gmail.com", company: "Hân Studio Studio", customFields: { discount: "30%", position: "Nhiếp ảnh gia" } },
  { id: "c10", name: "Phan Tấn Đạt", email: "dat.phan.demo@vietjetair.com", company: "Vietjet Air Cargo", customFields: { discount: "10%", position: "Trưởng nhóm" } },
  { id: "c11", name: "Trần Anh Quân", email: "quan.tran.demo@viettel.vn", company: "Viettel Telecom", customFields: { discount: "30%", position: "Kỹ sư mạng" } },
  { id: "c12", name: "Lý Thanh Bình", email: "binh.ly.demo@gmail.com", company: "Bình An Wood", customFields: { discount: "25%", position: "Trưởng QC" } }
];

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig | null>(() => {
    try {
      const saved = localStorage.getItem("smtp_config");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Lỗi đọc cấu hình SMTP khởi tạo:", e);
      return null;
    }
  });

  // Edit Campaign state management
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editRawContactsText, setEditRawContactsText] = useState("");

  // Form states for creating new campaign
  const [campaignName, setCampaignName] = useState("Chiến dịch Ưu Đãi Mùa Hè 2026");
  const [subject, setSubject] = useState("🚀 {{name}} ơi! Đừng bỏ lỡ ưu đãi đến {{discount}} từ chúng tôi!");
  
  // Scheduling states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${yr}-${mo}-${day}T${hh}:${mm}`;
  });
  const [editingScheduleAt, setEditingScheduleAt] = useState("");

  const [body, setBody] = useState(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px; }
    .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 40px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { font-size: 24px; font-weight: bold; color: #1e1b4b; text-align: center; margin-bottom: 24px; letter-spacing: -0.025em; }
    .body-text { font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px; }
    .cta-btn { display: block; text-align: center; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin: 30px auto; max-width: 250px; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 30px; }
    .badge { background-color: #e0e7ff; color: #4338ca; border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 500; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center; margin-bottom: 12px;"><span class="badge">QUÀ TẶNG THÀNH VIÊN</span></div>
    <div class="header">Ưu Đãi Đặc Quyền Tháng 5</div>
    <p class="body-text">Chào <strong>{{name}}</strong>,</p>
    <p class="body-text">Chúng tôi biết bạn đang giữ vai trò cực kỳ quan trọng là <strong>{{position}}</strong> tại <strong>{{company}}</strong>. Vì lẽ đó, chúng tôi vô cùng trân trọng gửi riêng tới bạn mã coupon đặc biệt giảm tới <strong>{{discount}}</strong> dành cho toàn bộ sản phẩm dịch vụ mới nhất.</p>
    
    <a href="https://example.com/promo-link?ref={{email}}" class="cta-btn">Kích Hoạt Ưu Đãi Ngay</a>
    
    <p class="body-text">Chương trình này chỉ mở ra cho các khách hàng VIP nhận được thư mời trực tiếp này. Hạn dùng khóa ưu đãi trước ngày 30/05/2026.</p>
    <div class="footer">
      Bạn nhận được thư này như một đặc quyền người dùng của {{company}}.<br>
      © 2026 MailFlow Pro Inc. | <a href="#" style="color:#64748b; text-decoration:underline;">Hủy đăng ký (Unsubscribe)</a>
    </div>
  </div>
</body>
</html>`);

  const [rawContactsText, setRawContactsText] = useState(JSON.stringify(DEMO_CONTACTS, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // States for sending a real test email
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // CSV Import related structures
  const [importMethod, setImportMethod] = useState<"csv" | "json">("csv");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<{ count: number; columns: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const splitCSVRow = (rowText: string, delimiter: string): string[] => {
    const result: string[] = [];
    let currentVal = "";
    let insideQuotes = false;

    for (let i = 0; i < rowText.length; i++) {
      const char = rowText[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        result.push(currentVal);
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    result.push(currentVal);
    
    return result.map(v => {
      let trimmed = v.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        trimmed = trimmed.substring(1, trimmed.length - 1);
      }
      return trimmed;
    });
  };

  const parseCSV = (csvText: string): Contact[] => {
    const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
      throw new Error("Tệp tin CSV phải chứa ít nhất dòng tiêu đề (header) và một dòng dữ liệu.");
    }

    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes(";")) delimiter = ";";
    else if (firstLine.includes("\t")) delimiter = "\t";

    const headers = splitCSVRow(firstLine, delimiter).map(h => h.trim().toLowerCase());
    
    const emailKeywords = ["email", "mail", "hộp thư", "hop thu", "địa chỉ email", "dia chi email", "e-mail"];
    const nameKeywords = ["name", "tên", "ten", "họ tên", "ho ten", "fullname", "người nhận", "nguoi nhan"];
    const companyKeywords = ["company", "công ty", "cong ty", "tổ chức", "to chuc", "doanh nghiệp", "doanh nghiep"];

    let emailIdx = headers.findIndex(h => emailKeywords.some(keyword => h.includes(keyword)));
    let nameIdx = headers.findIndex(h => nameKeywords.some(keyword => h.includes(keyword)));
    let companyIdx = headers.findIndex(h => companyKeywords.some(keyword => h.includes(keyword)));

    if (emailIdx === -1) {
      emailIdx = headers.findIndex(h => h.includes("mail")) !== -1 ? headers.findIndex(h => h.includes("mail")) : 0;
    }
    if (nameIdx === -1) {
      nameIdx = headers.findIndex(h => h !== headers[emailIdx]) !== -1 ? headers.findIndex(h => h !== headers[emailIdx]) : 1;
    }

    const parsedContacts: Contact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowValues = splitCSVRow(lines[i], delimiter);
      if (rowValues.length === 0 || (rowValues.length === 1 && rowValues[0] === "")) continue;

      const email = rowValues[emailIdx]?.trim() || "";
      if (!email || !email.includes("@")) continue;

      const name = rowValues[nameIdx]?.trim() || "Khách hàng";
      const company = companyIdx !== -1 ? rowValues[companyIdx]?.trim() : undefined;

      const customFields: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (index !== emailIdx && index !== nameIdx && index !== companyIdx) {
          const cleanHeader = header.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .replace(/[^a-zA-Z0-9]/g, "")
            .trim();
          if (cleanHeader && rowValues[index] !== undefined) {
            customFields[cleanHeader] = rowValues[index].trim();
          }
        }
      });

      parsedContacts.push({
        id: "csv_" + i + "_" + Math.random().toString(36).substring(2, 6),
        name,
        email,
        company,
        customFields
      });
    }

    if (parsedContacts.length === 0) {
      throw new Error("Không trích xuất được địa chỉ email hợp lệ nào từ tệp tin CSV vừa tải lên.");
    }

    return parsedContacts;
  };

  const downloadSampleCsv = () => {
    const content = "\ufeff" + "Họ Tên,Email,Công Ty,Chức Vụ,Mức Giảm Giá\n" +
      "Nguyễn Văn A,nguyenvana@gmail.com,Công Ty CP Tech,Giám đốc,30%\n" +
      "Trần Thị B,tranthib@outlook.com,Green Garden,Trưởng phòng,15%\n" +
      "Lê Văn C,levanc@gmail.com,VinGroup,Nhân viên,20%";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "mau_danh_sach_marketing.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setParseError(null);
    setCsvFeedback(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error("Không thể đọc nội dung tệp tin.");
        }
        const parsed = parseCSV(text);
        
        setRawContactsText(JSON.stringify(parsed, null, 2));
        
        const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        let columns: string[] = [];
        if (rawLines.length > 0) {
          const delim = rawLines[0].includes(";") ? ";" : (rawLines[0].includes("\t") ? "\t" : ",");
          columns = splitCSVRow(rawLines[0], delim);
        }

        setCsvFeedback({
          count: parsed.length,
          columns: columns
        });
      } catch (err: any) {
        setParseError("Lỗi đọc/phân tích CSV: " + err.message);
        setCsvFileName(null);
        setCsvFeedback(null);
      }
    };
    reader.onerror = () => {
      setParseError("Không thể đọc tệp tin này.");
    };
    reader.readAsText(file, "UTF-8");
  };

  // Tabs / switch states
  const [activeTab, setActiveTab] = useState<"campaigns" | "smtp" | "newCampaign" | "supabase" | "contacts">("campaigns");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Campaign Sub-tab and Reporting states
  const [campaignSubTab, setCampaignSubTab] = useState<"monitor" | "report">("monitor");
  const [reportSearch, setReportSearch] = useState("");
  const [reportFilterStatus, setReportFilterStatus] = useState<"all" | "success" | "failed" | "pending">("all");
  const [reportFilterInteract, setReportFilterInteract] = useState<"all" | "opened" | "clicked" | "none">("all");
  const [reportPage, setReportPage] = useState(1);
  const [previewContactIndex, setPreviewContactIndex] = useState(0);
  const [isAiConfigured, setIsAiConfigured] = useState(true);

  // AI-Assisted prompt parameters
  const [aiTopic, setAiTopic] = useState("Ra mắt sản phẩm mới: Cà phê Thảo mộc Organic sấy lạnh Organic Zen Coffee");
  const [aiTone, setAiTone] = useState("chuyên nghiệp");
  const [aiAudience, setAiAudience] = useState("Đối tác kinh doanh lớn, nhà thuốc, đại lý và người yêu thích sống lành mạnh");
  const [aiInstructions, setAiInstructions] = useState("Đồng hành cùng lối sống Zen tỉnh thức. Hãy khéo léo chèn biến {{name}} vào tiêu đề và biến {{company}} vào nội dung để tạo kết nối.");
  const [aiLanguage, setAiLanguage] = useState("Vietnamese");
  const [generatingWithAi, setGeneratingWithAi] = useState(false);
  const [aiAlertMessage, setAiAlertMessage] = useState<string | null>(null);

  // Auto-reload active campaigns for dynamic log tracking
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchCampaigns();
    checkAiKeyStatus();
    
    // Auto refresh status of campaigns every 2 seconds
    timerRef.current = setInterval(() => {
      silentRefresh();
    }, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatIsoForDatetimeInput = (isoString?: string | null): string => {
    if (!isoString) {
      const d = new Date();
      d.setHours(d.getHours() + 1);
      d.setMinutes(0);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${yr}-${mo}-${day}T${hh}:${mm}`;
    }
    const d = new Date(isoString);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${yr}-${mo}-${day}T${hh}:${mm}`;
  };

  useEffect(() => {
    if (selectedCampaign) {
      setEditingScheduleAt(formatIsoForDatetimeInput(selectedCampaign.scheduledAt));
    }
  }, [selectedCampaign?.id, selectedCampaign?.scheduledAt]);

  const checkAiKeyStatus = async () => {
    try {
      const response = await fetch(getApiUrl("/api/gemini/config-check"));
      const data = await handleApiResponse(response);
      setIsAiConfigured(data.isConfigured);
    } catch (e) {
      console.error("Lỗi kiểm tra API Key Status:", e);
    }
  };

  const fetchCampaigns = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(getApiUrl("/api/campaigns"));
      const list = await handleApiResponse(response);
      setCampaigns(list);
      
      // Keep selected campaign view updated with response
      if (selectedCampaign) {
        const found = list.find((c: Campaign) => c.id === selectedCampaign.id);
        if (found) {
          setSelectedCampaign(found);
        }
      } else if (list.length > 0 && !selectedCampaign) {
        setSelectedCampaign(list[0]);
      }
    } catch (error: any) {
      console.error("Lỗi khi tải danh sách chiến dịch:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const silentRefresh = async () => {
    try {
      const response = await fetch(getApiUrl("/api/campaigns"));
      const list = await handleApiResponse(response);
      setCampaigns(list);
      if (selectedCampaign) {
        const found = list.find((c: Campaign) => c.id === selectedCampaign.id);
        if (found) {
          setSelectedCampaign(found);
        }
      }
    } catch (e) {
      // Slient fail for background pooling
    }
  };

  // Pre-load current contacts parsed
  const getParsedContacts = (): Contact[] => {
    try {
      const parsed = JSON.parse(rawContactsText);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setParseError(null);

    let finalContacts: Contact[] = [];
    try {
      const parsed = JSON.parse(rawContactsText);
      if (!Array.isArray(parsed)) {
        throw new Error("Dữ liệu nhập vào phải là một mảng [] chứa các đối tượng khách hàng.");
      }
      
      // Ensure validity of contacts
      finalContacts = parsed.map((item, idx) => {
        if (!item.email || !item.name) {
          throw new Error(`Khách hàng dòng thứ ${idx+1} thiếu các trường tối thiểu 'name' hoặc 'email'.`);
        }
        return {
          id: item.id || `c_imported_${idx}_${Date.now()}`,
          name: item.name,
          email: item.email,
          company: item.company || "Quý khách",
          customFields: item.customFields || {}
        };
      });
    } catch (err: any) {
      setParseError(err.message || "Định dạng JSON không hợp lệ. Vui lòng kiểm tra lại dấu ngoặc và phẩy.");
      return;
    }

    if (finalContacts.length === 0) {
      setParseError("Danh sách khách hàng không được để trống.");
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/campaigns/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          subject,
          body,
          contacts: finalContacts,
          smtpConfig: smtpConfig,
          scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null
        })
      });

      const data = await handleApiResponse(response);
      if (response.ok && data.success) {
        setCampaignName(`Chiến dịch số #${Date.now().toString().slice(-4)}`);
        setIsScheduled(false);
        await fetchCampaigns();
        setSelectedCampaign(data.campaign);
        setActiveTab("campaigns");
      } else {
        setParseError(data.error || "Gặp lỗi khi ghi nhận chiến dịch với máy chủ.");
      }
    } catch (err: any) {
      setParseError("Không thể hoàn tất tạo chiến dịch: " + err.message);
    }
  };

  // Build AI Generated content via server-side Gemini 3.5 Flash
  const handleGenerateWithAi = async () => {
    if (!isAiConfigured) {
      setAiAlertMessage("⚠️ API Key chưa được đo lường cấu hình. Vào 'Settings > Secrets' để chèn GEMINI_API_KEY.");
      return;
    }

    setGeneratingWithAi(true);
    setAiAlertMessage(null);

    try {
      const response = await fetch(getApiUrl("/api/gemini/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          tone: aiTone,
          audience: aiAudience,
          instructions: aiInstructions,
          language: aiLanguage
        })
      });

      const data = await handleApiResponse(response);
      if (response.ok && data.success) {
        setSubject(data.subject);
        setBody(data.html);
        setAiAlertMessage("🎉 AI đã tạo nội dung thành công! Kiểm tra phần thiết kế email và bấm Tạo Chiến Dịch.");
      } else {
        setAiAlertMessage(`🔴 Lỗi API: ${data.error || "Không thể tạo nội dung."}`);
      }
    } catch (err: any) {
      setAiAlertMessage(`🔴 Trục trặc hệ thống kết nối: ${err.message}`);
    } finally {
      setGeneratingWithAi(false);
    }
  };

  // Controls for campaign flow
  const startCampaign = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/campaigns/${id}/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpConfig })
      });
      const data = await handleApiResponse(response);
      if (data.success) {
        await fetchCampaigns();
      }
    } catch (e: any) {
      console.error(e);
      alert(`Lỗi khi khởi chạy chiến dịch: ${e.message}`);
    }
  };

  const pauseCampaign = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/campaigns/${id}/pause`), { method: "POST" });
      const data = await handleApiResponse(response);
      if (data.success) {
        await fetchCampaigns();
      }
    } catch (e: any) {
      console.error(e);
      alert(`Lỗi khi tạm dừng chiến dịch: ${e.message}`);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa chiến dịch này không? Toàn bộ dấu vết lịch sử gửi sẽ bị loại bỏ.")) {
      return;
    }
    try {
      const response = await fetch(getApiUrl(`/api/campaigns/${id}/delete`), { method: "POST" });
      if (response.ok) {
        setSelectedCampaign(null);
        await fetchCampaigns();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEditingCampaign = (campaign: Campaign) => {
    setEditCampaignName(campaign.name);
    setEditSubject(campaign.subject);
    setEditBody(campaign.body);
    setEditRawContactsText(JSON.stringify(campaign.contacts, null, 2));
    setIsEditingCampaign(true);
  };

  const handleSaveEditedCampaign = async () => {
    if (!selectedCampaign) return;

    if (!editCampaignName.trim()) {
      alert("Vui lòng nhập tên chiến dịch.");
      return;
    }
    if (!editSubject.trim()) {
      alert("Vui lòng nhập tiêu đề thư.");
      return;
    }
    if (!editBody.trim()) {
      alert("Vui lòng nhập nội dung thư.");
      return;
    }

    let parsedContacts;
    try {
      parsedContacts = JSON.parse(editRawContactsText);
      if (!Array.isArray(parsedContacts)) {
        alert("Danh sách người nhận phải là một mảng JSON!");
        return;
      }
    } catch (e: any) {
      alert("Dữ liệu danh sách người nhận JSON không hợp lệ: " + e.message);
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/campaigns/${selectedCampaign.id}/update`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCampaignName.trim(),
          subject: editSubject.trim(),
          body: editBody,
          contacts: parsedContacts
        })
      });

      const data = await handleApiResponse(response);
      if (response.ok && data.success) {
        alert("✓ Đã cập nhật chiến dịch thành công!");
        setIsEditingCampaign(false);
        await fetchCampaigns();
      } else {
        alert(data.error || "Gặp lỗi khi lưu chỉnh sửa chiến dịch.");
      }
    } catch (err: any) {
      alert("Lỗi kết nối khi cập nhật chiến dịch: " + err.message);
    }
  };

  const updateCampaignSchedule = async (id: string, datetimeISO: string | null) => {
    try {
      const response = await fetch(getApiUrl(`/api/campaigns/${id}/schedule`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: datetimeISO })
      });
      const data = await handleApiResponse(response);
      if (response.ok && data.success) {
        await fetchCampaigns();
        // Update selection
        if (selectedCampaign && selectedCampaign.id === id) {
          setSelectedCampaign(data.campaign);
        }
      } else {
        alert(data.error || "Gặp lỗi khi ghi nhận lịch gửi.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi máy chủ: " + err.message);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.trim() || !testEmailRecipient.includes("@")) {
      alert("Vui lòng nhập địa chỉ email nhận thư thử nghiệm hợp lệ.");
      return;
    }

    setIsSendingTestEmail(true);

    try {
      // Find a sample contact in the current list to merge custom fields for realistic personalization testing
      let sampleContact = undefined;
      try {
        const parsed = JSON.parse(rawContactsText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sampleContact = parsed[0];
        }
      } catch (err) {
        // ignore parse error as they can just use standard fallback values from server
      }

      const response = await fetch(getApiUrl("/api/campaigns/send-test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          testEmail: testEmailRecipient,
          smtpConfig,
          testContact: sampleContact
        })
      });

      const data = await handleApiResponse(response);
      if (response.ok && data.success) {
        alert(`✓ ${data.message}`);
      } else {
        alert("❌ Thất bại gửi thư thử nghiệm: " + (data.error || "Lỗi SMTP không xác định."));
      }
    } catch (err: any) {
      console.error(err);
      alert("❌ Gặp lỗi đường truyền kết nối: " + err.message);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const loadDemoContacts = () => {
    setRawContactsText(JSON.stringify(DEMO_CONTACTS, null, 2));
    setParseError(null);
  };

  const loadDatabaseContacts = async () => {
    try {
      const response = await fetch(getApiUrl("/api/contacts"));
      const data = await response.json();
      if (Array.isArray(data)) {
        const activeList = data.filter((c: any) => c.status !== "bounced");
        if (activeList.length === 0) {
          alert("Danh bạ trung tâm hiện chưa có liên hệ nào hoạt động! Vui lòng vào tab '👤 Quản lý danh bạ' để nhập danh sách.");
          return;
        }
        setRawContactsText(JSON.stringify(activeList.map((c: any) => ({
          name: c.name,
          email: c.email,
          company: c.company,
          customFields: c.customFields
        })), null, 2));
        alert(`✓ Đã nạp thành công ${activeList.length} liên hệ hoạt động tốt từ Danh bạ Trung tâm! (Đã tự động loại bỏ ${data.length - activeList.length} email chết bị bounced)`);
      }
    } catch (err: any) {
      alert("Không thể kết nối lấy danh bạ: " + err.message);
    }
  };

  const handleUpdateSmtpConfig = (newConfig: SmtpConfig | null) => {
    setSmtpConfig(newConfig);
    try {
      if (newConfig) {
        localStorage.setItem("smtp_config", JSON.stringify(newConfig));
        alert(`Đã lưu cấu hình máy chủ SMTP thành công vào trình duyệt! Khoảng giãn cách gửi được thiết lập ở mức: ${newConfig.delaySeconds || 15} giây giữa các email.`);
      } else {
        localStorage.removeItem("smtp_config");
        alert("Đã xoá cấu hình SMTP.");
      }
    } catch (e) {
      console.error("Lỗi khi lưu cấu hình SMTP vào localStorage:", e);
    }
  };

  const handleCreateNewCampaignClick = () => {
    setCampaignName(`Chiến dịch mới #${Date.now().toString().slice(-4)}`);
    setSubject("🚀 {{name}} ơi! Đừng bỏ lỡ ưu đãi đặc biệt mới nhất từ chúng tôi!");
    setBody(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px; }
    .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 40px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { font-size: 24px; font-weight: bold; color: #1e1b4b; text-align: center; margin-bottom: 24px; letter-spacing: -0.025em; }
    .body-text { font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px; }
    .cta-btn { display: block; text-align: center; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; margin: 30px auto; max-width: 250px; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 30px; }
    .badge { background-color: #e0e7ff; color: #4338ca; border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 500; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align: center; margin-bottom: 12px;"><span class="badge">ƯU ĐÃI THÀNH VIÊN</span></div>
    <div class="header">Gửi riêng người bạn {{name}} đồng hành</div>
    <p class="body-text">Xin chào <strong>{{name}}</strong>,</p>
    <p class="body-text">Chúng tôi vô cùng vinh hạnh khi bạn đang giữ vai trò là <strong>{{position}}</strong> tại <strong>{{company}}</strong>. Để đồng hành cùng những nỗ lực tuyệt vời đó, chúng tôi gửi tặng riêng bạn cơ hội giảm giá <strong>{{discount}}</strong>.</p>
    
    <a href="https://example.com/promo-link?ref={{email}}" class="cta-btn">Nhận Ưu Đãi Của Bạn</a>
    
    <p class="body-text">Chương trình chỉ áp dụng cho người nhận trực tiếp thư này. Hạn kết thúc trước ngày cuối tháng này.</p>
    <div class="footer">
      Bạn nhận được thư này dựa trên đăng ký tại {{company}}.<br>
      © 2026 MailFlow Pro | <a href="#" style="color:#64748b; text-decoration:underline;">Hủy đăng ký</a>
    </div>
  </div>
</body>
</html>`);
    setAiTopic("");
    setAiInstructions("");
    setAiAlertMessage(null);
    setIsScheduled(false);
    setParseError(null);
    setActiveTab("newCampaign");
  };

  // Compile individual templates for visual previews with interactive variables
  const compileText = (text: string, contact: Contact | undefined): string => {
    if (!contact) return text;
    let result = text;
    const placeholderValues: Record<string, string> = {
      email: contact.email,
      name: contact.name,
      company: contact.company || "Doanh nghiệp",
      ...(contact.customFields || {})
    };

    for (const [key, val] of Object.entries(placeholderValues)) {
      const r = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
      result = result.replace(r, val);
    }
    return result;
  };

  const currentContacts = selectedCampaign?.contacts || getParsedContacts();
  const activeContactForPreview = currentContacts[previewContactIndex % (currentContacts.length || 1)] || null;

  const totalSendingCount = selectedCampaign?.contacts?.length || 0;
  const sentProgressPercent = totalSendingCount > 0 
    ? Math.round(((selectedCampaign?.currentIndex || 0) / totalSendingCount) * 100) 
    : 0;

  const getContactReportData = (campaign: Campaign) => {
    if (!campaign || !campaign.contacts) return [];

    const emailLogsMap: Record<string, {
      deliveryStatus: "success" | "failed" | "pending";
      errorDetails: string;
      interaction: "clicked" | "opened" | "none";
      lastUpdated: string;
    }> = {};

    campaign.contacts.forEach(contact => {
      emailLogsMap[contact.email.toLowerCase()] = {
        deliveryStatus: "pending",
        errorDetails: "",
        interaction: "none",
        lastUpdated: campaign.createdAt || new Date().toISOString()
      };
    });

    if (campaign.logs && Array.isArray(campaign.logs)) {
      campaign.logs.forEach(log => {
        const emailKey = log.email.toLowerCase();
        if (!emailLogsMap[emailKey]) {
          emailLogsMap[emailKey] = {
            deliveryStatus: "pending",
            errorDetails: "",
            interaction: "none",
            lastUpdated: log.timestamp
          };
        }

        const current = emailLogsMap[emailKey];
        current.lastUpdated = log.timestamp;

        if (log.status === "success") {
          current.deliveryStatus = "success";
        } else if (log.status === "failed") {
          current.deliveryStatus = "failed";
          current.errorDetails = log.message;
        } else if (log.status === "opened") {
          if (current.interaction !== "clicked") {
            current.interaction = "opened";
          }
        } else if (log.status === "clicked") {
          current.interaction = "clicked";
        }
      });
    }

    return campaign.contacts.map(contact => {
      const emailKey = contact.email.toLowerCase();
      const logInfo = emailLogsMap[emailKey] || {
        deliveryStatus: "pending",
        errorDetails: "",
        interaction: "none",
        lastUpdated: campaign.createdAt || new Date().toISOString()
      };

      return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company || "Không có",
        deliveryStatus: logInfo.deliveryStatus,
        errorDetails: logInfo.errorDetails,
        interaction: logInfo.interaction,
        lastUpdated: logInfo.lastUpdated
      };
    });
  };

  const downloadCsvReport = (campaign: Campaign) => {
    if (!campaign) return;
    const reportData = getContactReportData(campaign);
    
    let csvContent = "\ufeff";
    csvContent += "Họ Tên,Email,Công Ty,Trạng Thái Gửi,Tương Tác,Lỗi Chi Tiết,Thời Gian Cập Nhật\n";

    reportData.forEach(row => {
      const name = `"${row.name.replace(/"/g, '""')}"`;
      const email = `"${row.email.replace(/"/g, '""')}"`;
      const company = `"${row.company.replace(/"/g, '""')}"`;
      
      let deliveryStr = "Chưa gửi";
      if (row.deliveryStatus === "success") deliveryStr = "Đã gửi thành công";
      if (row.deliveryStatus === "failed") deliveryStr = "Thất bại";

      let interactStr = "Chưa tương tác";
      if (row.interaction === "opened") interactStr = "Đã mở thư";
      if (row.interaction === "clicked") interactStr = "Đã click liên kết";

      const error = `"${row.errorDetails.replace(/"/g, '""')}"`;
      const timeStr = `"${new Date(row.lastUpdated).toLocaleString("vi-VN")}"`;

      csvContent += `${name},${email},${company},${deliveryStr},${interactStr},${error},${timeStr}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const cleanCampName = campaign.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_");
    
    link.setAttribute("download", `bao_cao_chien_dich_${cleanCampName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 antialiased overflow-x-hidden">
      
      {/* HEADER: Geometric Balance Brand Bar */}
      <header className="h-16 md:h-18 flex items-center justify-between px-4 md:px-8 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm gap-2">
        <div className="flex items-center space-x-2 shrink-0">
          <div className="w-7 h-7 md:w-8 md:h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
            <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white rounded-sm" />
          </div>
          <span className="text-base md:text-xl font-extrabold tracking-tight text-slate-800 shrink-0">
            MAILFLOW<span className="text-indigo-600 font-extrabold">PRO</span>
          </span>
          <span className="hidden lg:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            AI Marketing
          </span>
        </div>

        {/* Top Sticky Navigation */}
        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-1 md:space-x-2 text-xs md:text-sm font-semibold py-1.5 px-1 whitespace-nowrap shrink-0">
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`px-3 py-2 rounded-lg transition-colors ${
              activeTab === "campaigns"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
            }`}
          >
            📋 Chiến dịch
          </button>
          <button
            onClick={() => setActiveTab("newCampaign")}
            className={`px-3 py-2 rounded-lg transition-colors ${
              activeTab === "newCampaign"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
            }`}
          >
            💡 Soạn thảo bằng AI
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-3 py-2 rounded-lg transition-colors ${
              activeTab === "contacts"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
            }`}
          >
            👤 Quản lý danh bạ
          </button>
          <button
            onClick={() => setActiveTab("smtp")}
            className={`px-3 py-2 rounded-lg transition-colors ${
              activeTab === "smtp"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
            }`}
          >
            ⚙️ Cấu Hình SMTP {smtpConfig ? "📬" : ""}
          </button>
          <button
            onClick={() => setActiveTab("supabase")}
            className={`px-3 py-2 rounded-lg transition-colors ${
              activeTab === "supabase"
                ? "text-indigo-600 bg-indigo-50"
                : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100"
            }`}
          >
            🔌 Kết nối Supabase
          </button>
        </nav>

        {/* Mobile Dropdown Navigation */}
        <div className="relative md:hidden shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
          >
            <span>
              {activeTab === "campaigns" && "📋 Chiến dịch"}
              {activeTab === "newCampaign" && "💡 Soạn thảo bằng AI"}
              {activeTab === "contacts" && "👤 Danh bạ"}
              {activeTab === "smtp" && `⚙️ Cấu hình SMTP ${smtpConfig ? "📬" : ""}`}
              {activeTab === "supabase" && "🔌 Supabase"}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isMobileMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isMobileMenuOpen && (
            <>
              {/* Invisible Backdrop to close menu */}
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setIsMobileMenuOpen(false)}
              />
              
              {/* Dropdown Menu list */}
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setActiveTab("campaigns");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center transition-colors ${
                    activeTab === "campaigns"
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                  }`}
                >
                  📋 Chiến dịch
                </button>
                <button
                  onClick={() => {
                    setActiveTab("newCampaign");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center transition-colors ${
                    activeTab === "newCampaign"
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                  }`}
                >
                  💡 Soạn thảo bằng AI
                </button>
                <button
                  onClick={() => {
                    setActiveTab("contacts");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center transition-colors ${
                    activeTab === "contacts"
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-slate-550/5"
                  }`}
                >
                  👤 Quản lý danh bạ
                </button>
                <button
                  onClick={() => {
                    setActiveTab("smtp");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center transition-colors ${
                    activeTab === "smtp"
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                  }`}
                >
                  ⚙️ Cấu hình SMTP {smtpConfig ? "📬" : ""}
                </button>
                <button
                  onClick={() => {
                    setActiveTab("supabase");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center transition-colors ${
                    activeTab === "supabase"
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                  }`}
                >
                  🔌 Kết nối Supabase
                </button>
              </div>
            </>
          )}
        </div>

        {/* User Status Profile */}
        <div className="hidden md:flex items-center space-x-3 pl-4 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-sm">
            AD
          </div>
          <div className="text-xs">
            <p className="font-bold text-slate-800">Administrator</p>
            <p className="text-slate-400">phandu8899@gmail.com</p>
          </div>
        </div>
      </header>

       {/* SUB-HEADER: Mode Status alert */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-2.5 text-center text-xs text-white flex items-center justify-center gap-3 shadow-std">
        <span className={`inline-block px-2 py-0.5 rounded font-black tracking-wide text-[10px] uppercase ${smtpConfig ? "bg-emerald-500 text-slate-950 animate-pulse" : "bg-red-500 text-white animate-bounce"}`}>
          {smtpConfig ? "SMTP LIVE" : "SMTP CHƯA CẤU HÌNH"}
        </span>
        <span className="font-semibold text-slate-200">
          {smtpConfig 
            ? `Hệ thống kết nối thực tế đến cổng: ${smtpConfig.host}:${smtpConfig.port} dưới tên "${smtpConfig.fromName}" (Trễ: ${smtpConfig.delaySeconds || 15}s/email)` 
            : "⚠️ ĐÃ TẮT MÔ PHỎNG. Hãy nhập cổng SMTP thật của bạn ở Tab '⚙️ Cấu Hình SMTP' để có thể kích hoạt các chiến dịch gửi đi."
          }
        </span>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT SIDEBAR / SYSTEM CONTROL: Campaign Navigation (Grid span 4) */}
        <section className="lg:col-span-4 space-y-6">
          
           {/* Campaign List block */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 gap-1">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Danh sách chiến dịch</h3>
                <p className="text-xs text-slate-400 mt-0.5">Chọn dòng để xem chi tiết</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCreateNewCampaignClick}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition shadow-sm"
                  title="Tạo chiến dịch mới"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm Mới
                </button>
                <button
                  onClick={fetchCampaigns}
                  disabled={isRefreshing}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition border border-slate-100"
                  title="Làm mới danh sách"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="space-y-3 mt-4 max-h-[350px] overflow-y-auto pr-1">
              {campaigns.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 px-4">
                  <Mail className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500 mt-2">Chưa có chiến dịch nào.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Bấm nút "Soạn thảo bằng AI" hoặc tạo mới ở thẻ trên để bắt đầu tiếp thị.</p>
                  <button
                    onClick={() => setActiveTab("newCampaign")}
                    className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                  >
                    <Plus className="h-3 w-3" /> Soạn Ngay
                  </button>
                </div>
              ) : (
                campaigns.map((camp) => (
                  <button
                    key={camp.id}
                    onClick={() => {
                      setSelectedCampaign(camp);
                      setActiveTab("campaigns");
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col gap-2 ${
                      selectedCampaign?.id === camp.id
                        ? "bg-indigo-50/75 border-indigo-200 text-indigo-950 shadow-sm"
                        : "bg-white border-slate-100 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs truncate max-w-[70%]">{camp.name}</span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          camp.status === "sending"
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : camp.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : camp.status === "paused"
                            ? "bg-blue-100 text-blue-800"
                            : camp.status === "scheduled"
                            ? "bg-purple-100 text-purple-800 animate-bounce-slow"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {camp.status === "sending"
                          ? "● Đang gửi"
                          : camp.status === "completed"
                          ? "✓ Hoàn tất"
                          : camp.status === "paused"
                          ? "⏸ Tạm dừng"
                          : camp.status === "scheduled"
                          ? "⏰ Hẹn giờ"
                          : "Nháp"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 line-clamp-1 italic">
                      Tiêu đề: {camp.subject}
                    </div>

                    {camp.status === "scheduled" && camp.scheduledAt && (
                      <div className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1.5 rounded-lg font-semibold border border-purple-100 flex items-center gap-1">
                        ⏰ Gửi tự động lúc: <span className="font-bold">{new Date(camp.scheduledAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-dashed border-slate-100 pt-2 mt-1">
                      <span>👤 {camp.contacts.length} khách nhận</span>
                      <span className="font-mono">{camp.sentCount}/{camp.contacts.length} đã gửi</span>
                    </div>

                    {/* Progress slider mini */}
                    <div className="w-full bg-slate-200/60 rounded-full h-1 mt-1 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((camp.currentIndex / camp.contacts.length) * 100))}%` }}
                      />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Quick Sandbox Guide box */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl p-5 border border-slate-800 shadow-xl">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Sức Mạnh Email Tiếp Thị AI
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Dịch vụ hỗ trợ cá nhân hóa sâu tới từng khách hàng bằng ngôn ngữ tự nhiên. 
              Bạn có thể sử dụng các biến giữ chỗ của chúng tôi trong thư:
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-[11px]">
              <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <span className="text-indigo-300 block">{"{{name}}"}</span>
                <span className="text-[10px] text-slate-500">Tên đầy đủ</span>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <span className="text-indigo-300 block">{"{{company}}"}</span>
                <span className="text-[10px] text-slate-500">Doanh nghiệp</span>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <span className="text-indigo-300 block">{"{{discount}}"}</span>
                <span className="text-[10px] text-slate-500">Mức giảm giá</span>
              </div>
              <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <span className="text-indigo-300 block">{"{{position}}"}</span>
                <span className="text-[10px] text-slate-500">Địa vị chức vụ</span>
              </div>
            </div>
          </div>

        </section>

        {/* LEFT COMPOSER & PREVIEW AREA (Grid span 8) */}
        <section className="col-span-1 lg:col-span-8 space-y-6">

          {/* TABS VIEW-PORTS CONDITIONAL */}
          
          {/* TAB 1: Real-time Analytics Dashboard & Monitor Campaign */}
          {activeTab === "campaigns" && (
            <div className="space-y-6">
              
              {/* Campaign Statistics Row */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 tracking-wider block">TIẾN TRÌNH CHIẾN DỊCH ĐANG CHỌN</span>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                      {selectedCampaign ? selectedCampaign.name : "Vui lòng chọn hoặc Tạo mới chiến dịch để theo dõi"}
                    </h2>
                  </div>

                  {selectedCampaign && (
                    <div className="flex items-center gap-2">
                      {selectedCampaign.status === "sending" ? (
                        <button
                          onClick={() => pauseCampaign(selectedCampaign.id)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow"
                        >
                          <Pause className="h-3.5 w-3.5 fill-current" /> Tạm dừng gửi
                        </button>
                      ) : (
                        <button
                          onClick={() => startCampaign(selectedCampaign.id)}
                          disabled={selectedCampaign.status === "completed"}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" /> {selectedCampaign.currentIndex > 0 ? "Tiếp tục gửi" : "Bắt đầu chạy"}
                        </button>
                      )}

                      <button
                        onClick={() => startEditingCampaign(selectedCampaign)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-lg transition"
                        title="Chỉnh sửa chiến dịch"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => deleteCampaign(selectedCampaign.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 hover:border-rose-100 rounded-lg transition"
                        title="Xóa chiến dịch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {selectedCampaign ? (
                  <div>
                    {/* Schedule campaign notification banner */}
                    {selectedCampaign.status === "scheduled" && selectedCampaign.scheduledAt && (
                      <div className="mb-5 p-4 bg-purple-50 hover:bg-purple-100/60 border border-purple-150 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm transition duration-150">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700">
                            <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
                            ⏰ CHIẾN DỊCH ĐÃ HẸN GIỜ GỬI TỰ ĐỘNG
                          </span>
                          <p className="text-xs text-slate-650 leading-normal">
                            Chiến dịch này sẽ tự động khởi động gửi thư vào lúc:{" "}
                            <strong className="text-purple-800 font-bold underline bg-purple-100/50 px-1 rounded">
                              {new Date(selectedCampaign.scheduledAt).toLocaleString("vi-VN", { dateStyle: "long", timeStyle: "medium" })}
                            </strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startCampaign(selectedCampaign.id)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          >
                            ⚡ Gửi ngay lập tức
                          </button>
                          <button
                            onClick={() => updateCampaignSchedule(selectedCampaign.id, null)}
                            className="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          >
                            ✕ Hủy lịch hẹn
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Schedule / Reschedule campaign controls */}
                    {(selectedCampaign.status === "draft" || selectedCampaign.status === "paused" || selectedCampaign.status === "scheduled") && (
                      <div className="mb-6 p-4 bg-slate-50/70 border border-slate-200/50 rounded-xl space-y-3 shadow-inner">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">⏰ Thiết lập lịch gửi cho chiến dịch này</span>
                            {selectedCampaign.status === "scheduled" && (
                              <span className="bg-purple-100/80 text-purple-800 px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase">Cấu hình lịch hiện có</span>
                            )}
                          </div>
                          {selectedCampaign.status === "scheduled" && (
                            <button
                              onClick={() => updateCampaignSchedule(selectedCampaign.id, null)}
                              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold transition flex items-center gap-0.5"
                            >
                              ✕ gỡ bỏ lịch hẹn
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                          <div className="flex-1 space-y-1">
                            <span className="text-[10px] text-slate-500 font-semibold block">Ngày giờ kích hoạt (Múi giờ máy tính):</span>
                            <input
                              type="datetime-local"
                              value={editingScheduleAt}
                              onChange={(e) => setEditingScheduleAt(e.target.value)}
                              className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-750 bg-white focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (!editingScheduleAt) {
                                alert("Vui lòng chọn ngày và giờ gửi.");
                                return;
                              }
                              updateCampaignSchedule(selectedCampaign.id, new Date(editingScheduleAt).toISOString());
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 text-xs rounded-lg transition shrink-0 shadow-sm"
                          >
                            {selectedCampaign.status === "scheduled" ? "🔄 Thay đổi lịch gửi" : "📅 Đăng ký gửi tự động"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Visual Stats Block */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      
                      <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/50 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số liên hệ</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-extrabold text-slate-900">{selectedCampaign.contacts.length}</span>
                          <span className="text-xs text-slate-500 font-medium">người</span>
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100/60 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Đã thực gửi</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-extrabold text-indigo-700">{selectedCampaign.sentCount}</span>
                          <span className="text-[10px] text-indigo-500 font-bold">
                            ({Math.round((selectedCampaign.sentCount / (selectedCampaign.contacts.length || 1)) * 100)}%)
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Mở thư (Opens)</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-extrabold text-emerald-700">{selectedCampaign.openCount}</span>
                          <span className="text-[10px] text-emerald-500 font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                            CTR {selectedCampaign.sentCount > 0 ? Math.round((selectedCampaign.openCount / selectedCampaign.sentCount) * 100) : 0}%
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/50 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Kích liên kết (Clicks)</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-extrabold text-amber-700">{selectedCampaign.clickCount}</span>
                          <span className="text-[10px] text-amber-500 font-bold">
                            {selectedCampaign.openCount > 0 ? Math.round((selectedCampaign.clickCount / selectedCampaign.openCount) * 100) : 0}% click
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Progress with percent bar */}
                    <div className="mt-6">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="font-semibold text-slate-550">Chi tiết tốc độ truyền gửi hằng ngày</span>
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          {selectedCampaign.currentIndex} / {selectedCampaign.contacts.length} đã xử lý xong
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300 animate-pulse"
                          style={{ width: `${sentProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Sub-tab Navigation */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3">
                      <button
                        onClick={() => setCampaignSubTab("monitor")}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                          campaignSubTab === "monitor"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-105 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        🖥️ Console & Xem Thử Thư
                      </button>
                      <button
                        onClick={() => {
                          setCampaignSubTab("report");
                          setReportPage(1);
                        }}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                          campaignSubTab === "report"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-105 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        📊 Danh Sách Người Nhận & Báo Cáo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Hãy tạo chiến dịch mới bên thanh soạn thảo, hoặc chọn chiến dịch mẫu có sẵn để giám sát tiến độ hoạt động.
                  </div>
                )}
              </div>

              {/* Real-time Email Visualizer & Customer View or Detailed Report */}
              {selectedCampaign && (
                <>
                  {campaignSubTab === "monitor" ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-in fade-in duration-200">
                      
                      {/* Left Column: Email Preview Window */}
                      <div className="border-r border-slate-100 flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Xem thử trực tiếp từ hộp thư</span>
                          </div>
                          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                            <button
                              onClick={() => setPreviewDevice("desktop")}
                              className={`p-1.5 rounded transition ${previewDevice === "desktop" ? "bg-indigo-50 text-indigo-700" : "text-slate-400 hover:text-slate-600"}`}
                              title="Giao diện máy tính"
                            >
                              <Laptop className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setPreviewDevice("mobile")}
                              className={`p-1.5 rounded transition ${previewDevice === "mobile" ? "bg-indigo-50 text-indigo-700" : "text-slate-400 hover:text-slate-600"}`}
                              title="Giao diện điện thoại"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-5 border-b border-slate-100 bg-indigo-50/10">
                          <div className="space-y-2 text-xs">
                            <div className="flex">
                              <span className="w-16 font-semibold text-slate-400">Tiêu đề:</span>
                              <span className="font-bold text-slate-800 flex-1">
                                {compileText(selectedCampaign.subject, activeContactForPreview)}
                              </span>
                            </div>
                            <div className="flex">
                              <span className="w-16 font-semibold text-slate-400">Gửi đến:</span>
                              <span className="text-indigo-600 font-bold flex-1 flex items-center gap-1.5">
                                {activeContactForPreview?.name} ({activeContactForPreview?.email})
                                <span className="text-[10px] text-slate-400 font-normal">
                                  - Công ty: {activeContactForPreview?.company}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Email body render */}
                        <div className="p-4 flex-1 bg-slate-100 min-h-[350px] flex items-center justify-center">
                          <div
                            className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-auto transition-all ${
                              previewDevice === "desktop" ? "w-full max-w-full" : "w-[340px] max-w-full h-[450px]"
                            }`}
                          >
                            <iframe
                              title="Email Preview Inside Sandbox"
                              sandbox="allow-same-origin"
                              srcDoc={compileText(selectedCampaign.body, activeContactForPreview)}
                              className="w-full h-full border-none min-h-[320px] bg-white scroll-p-2"
                            />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span className="font-medium">Thư thứ {previewContactIndex + 1} / {currentContacts.length}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPreviewContactIndex(prev => Math.max(0, prev - 1))}
                              disabled={previewContactIndex === 0}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 transition font-semibold disabled:opacity-55"
                            >
                              ⇦ Trước
                            </button>
                            <button
                              onClick={() => setPreviewContactIndex(prev => Math.min(currentContacts.length - 1, prev + 1))}
                              disabled={previewContactIndex >= currentContacts.length - 1}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 transition font-semibold disabled:opacity-55"
                            >
                              Sau ⇨
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Interactive SMTP Terminal Exchanges & Logs */}
                      <div className="flex flex-col">
                        <div className="p-4 bg-slate-900 text-indigo-400 border-b border-indigo-950 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-100">
                              Bảng giám sát giao tiếp socket smtp
                            </span>
                          </div>
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        {/* Simulation logs list */}
                        <div className="p-4 flex-1 bg-slate-950 text-slate-350 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[500px]">
                          {selectedCampaign.logs && selectedCampaign.logs.length > 0 ? (
                            <div className="space-y-2">
                              {selectedCampaign.logs.map((log, index) => {
                                let colorClass = "text-slate-400";
                                if (log.status === "success") colorClass = "text-emerald-400 font-semibold";
                                if (log.status === "failed") colorClass = "text-rose-400 font-bold bg-rose-950/20 px-1 py-0.5 rounded";
                                if (log.status === "opened") colorClass = "text-yellow-400";
                                if (log.status === "clicked") colorClass = "text-cyan-400 font-extrabold animate-bounce";
                                if (log.status === "connecting" || log.status === "delivering") colorClass = "text-blue-400";

                                return (
                                  <div key={index} className="border-b border-slate-900/60 pb-1.5">
                                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                      <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                      <span>{log.email}</span>
                                    </div>
                                    <div className={colorClass}>
                                      {log.message}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-20 text-slate-500 italic">
                              <p>Bảng điện tử trống.</p>
                              <p className="text-[10px] mt-2">Bấm "BẮT ĐẦU GỬI" để theo dõi trực tiếp chuỗi nhật ký SMTP (MAIL FROM, AUTH LOGIN, RCPT TO, rác thải, bounce rate v.v.)</p>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-slate-900 border-t border-slate-900 text-[10px] text-slate-400 flex items-center justify-between">
                          <span className="font-mono">Mã hóa socket: TLS / SSL Sec</span>
                          <span>Hãng: SMTP Node - Simulator Pro</span>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                            📊 Báo Cáo Tiếp Thị Chi Tiết
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">Số liệu phân tích hành vi tương tác và trạng thái truyền phát thực tế</p>
                        </div>
                        <button
                          onClick={() => downloadCsvReport(selectedCampaign)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
                        >
                          <Download className="h-4 w-4" /> Xuất Báo Cáo CSV
                        </button>
                      </div>

                      {/* Visual Dashboard Charts */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Donut Chart: Delivery Status */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tỷ lệ truyền gửi</h4>
                          <div className="relative w-28 h-28 flex items-center justify-center">
                            {/* SVG Donut Chart */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                              {(() => {
                                const total = selectedCampaign.contacts.length || 1;
                                const reportData = getContactReportData(selectedCampaign);
                                const successCount = reportData.filter(r => r.deliveryStatus === "success").length;
                                const failedCount = reportData.filter(r => r.deliveryStatus === "failed").length;
                                
                                const sPct = (successCount / total) * 100;
                                const fPct = (failedCount / total) * 100;
                                const strokeDashSuccess = `${sPct} ${100 - sPct}`;
                                const strokeDashFailed = `${fPct} ${100 - fPct}`;
                                
                                return (
                                  <>
                                    {sPct > 0 && (
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3" 
                                              strokeDasharray={strokeDashSuccess} strokeDashoffset="0" />
                                    )}
                                    {fPct > 0 && (
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f43f5e" strokeWidth="3" 
                                              strokeDasharray={strokeDashFailed} strokeDashoffset={-sPct} />
                                    )}
                                  </>
                                );
                              })()}
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                              <span className="text-lg font-black text-slate-800">
                                {selectedCampaign.contacts.length > 0 
                                  ? Math.round((getContactReportData(selectedCampaign).filter(r => r.deliveryStatus === "success").length / selectedCampaign.contacts.length) * 100)
                                  : 0}%
                              </span>
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Thành công</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-4 mt-3 text-[10px] font-semibold text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Thành công</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full" /> Thất bại</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-300 rounded-full" /> Chờ gửi</span>
                          </div>
                        </div>

                        {/* Interactive Engagement Progress Bars */}
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 md:col-span-2 flex flex-col justify-between">
                          <h4 className="text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Chỉ số tương tác khách hàng (Dựa trên số đã gửi thành công)</h4>
                          
                          {(() => {
                            const reportData = getContactReportData(selectedCampaign);
                            const successTotal = reportData.filter(r => r.deliveryStatus === "success").length || 1;
                            
                            const openedCount = reportData.filter(r => r.interaction === "opened" || r.interaction === "clicked").length;
                            const clickedCount = reportData.filter(r => r.interaction === "clicked").length;
                            const noneCount = reportData.filter(r => r.interaction === "none" && r.deliveryStatus === "success").length;
                            
                            const openPct = Math.round((openedCount / successTotal) * 100);
                            const clickPct = Math.round((clickedCount / successTotal) * 100);
                            const nonePct = Math.round((noneCount / successTotal) * 100);

                            return (
                              <div className="space-y-3.5">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-bold text-slate-700">
                                    <span className="flex items-center gap-1">📬 Tỷ lệ mở email (Opens)</span>
                                    <span>{openPct}% ({openedCount} người)</span>
                                  </div>
                                  <div className="w-full bg-slate-205 rounded-full h-2 overflow-hidden">
                                    <div className="bg-indigo-650 h-2 rounded-full transition-all" style={{ width: `${openPct}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-bold text-slate-700">
                                    <span className="flex items-center gap-1">⚡ Tỷ lệ kích liên kết (Clicks)</span>
                                    <span>{clickPct}% ({clickedCount} người)</span>
                                  </div>
                                  <div className="w-full bg-slate-205 rounded-full h-2 overflow-hidden">
                                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${clickPct}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-bold text-slate-700">
                                    <span className="flex items-center gap-1">💤 Chưa tương tác (No action)</span>
                                    <span>{nonePct}% ({noneCount} người)</span>
                                  </div>
                                  <div className="w-full bg-slate-205 rounded-full h-2 overflow-hidden">
                                    <div className="bg-slate-400 h-2 rounded-full transition-all" style={{ width: `${nonePct}%` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                      </div>

                      {/* Recipient Table Filters */}
                      <div className="space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="text-xs font-bold text-slate-700 font-semibold">Bộ lọc danh sách người nhận</div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 lg:max-w-2xl">
                            {/* Search field */}
                            <input
                              type="text"
                              placeholder="Tìm tên / email..."
                              value={reportSearch}
                              onChange={(e) => {
                                setReportSearch(e.target.value);
                                setReportPage(1);
                              }}
                              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
                            />
                            
                            {/* Filter Delivery Status */}
                            <select
                              value={reportFilterStatus}
                              onChange={(e) => {
                                setReportFilterStatus(e.target.value as any);
                                setReportPage(1);
                              }}
                              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white text-slate-600 font-semibold"
                            >
                              <option value="all">Tất cả Trạng thái gửi</option>
                              <option value="success">✅ Đã gửi thành công</option>
                              <option value="failed">❌ Gửi thất bại</option>
                              <option value="pending">⏳ Đang chờ gửi</option>
                            </select>

                            {/* Filter Interaction */}
                            <select
                              value={reportFilterInteract}
                              onChange={(e) => {
                                setReportFilterInteract(e.target.value as any);
                                setReportPage(1);
                              }}
                              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white text-slate-600 font-semibold"
                            >
                              <option value="all">Tất cả tương tác</option>
                              <option value="opened">📬 Đã mở thư</option>
                              <option value="clicked">⚡ Đã click liên kết</option>
                              <option value="none">💤 Chưa tương tác</option>
                            </select>
                          </div>
                        </div>

                        {/* Recipient status Table */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                          {(() => {
                            const rawReportData = getContactReportData(selectedCampaign);
                            
                            const filteredData = rawReportData.filter(row => {
                              const matchSearch = row.name.toLowerCase().includes(reportSearch.toLowerCase()) || 
                                                  row.email.toLowerCase().includes(reportSearch.toLowerCase());
                              
                              let matchStatus = true;
                              if (reportFilterStatus === "success") matchStatus = row.deliveryStatus === "success";
                              if (reportFilterStatus === "failed") matchStatus = row.deliveryStatus === "failed";
                              if (reportFilterStatus === "pending") matchStatus = row.deliveryStatus === "pending";

                              let matchInteract = true;
                              if (reportFilterInteract === "opened") matchInteract = row.interaction === "opened" || row.interaction === "clicked";
                              if (reportFilterInteract === "clicked") matchInteract = row.interaction === "clicked";
                              if (reportFilterInteract === "none") matchInteract = row.interaction === "none" && row.deliveryStatus === "success";

                              return matchSearch && matchStatus && matchInteract;
                            });

                            const itemsPerPage = 10;
                            const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
                            const currentPageData = filteredData.slice((reportPage - 1) * itemsPerPage, reportPage * itemsPerPage);

                            return (
                              <>
                                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                    <tr>
                                      <th className="px-4 py-3">Người Nhận & Email</th>
                                      <th className="px-4 py-3">Công Ty</th>
                                      <th className="px-4 py-3">Trạng Thái Gửi</th>
                                      <th className="px-4 py-3">Tương Tác</th>
                                      <th className="px-4 py-3">Cập Nhật Cuối</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-650">
                                    {currentPageData.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                          Không tìm thấy dữ liệu người nhận phù hợp với bộ lọc.
                                        </td>
                                      </tr>
                                    ) : (
                                      currentPageData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/50 transition">
                                          <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800">{row.name}</div>
                                            <div className="text-[10px] text-slate-400 font-semibold">{row.email}</div>
                                          </td>
                                          <td className="px-4 py-3 font-medium text-slate-500">{row.company}</td>
                                          <td className="px-4 py-3">
                                            {row.deliveryStatus === "success" && (
                                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                                                ✓ Thành công
                                              </span>
                                            )}
                                            {row.deliveryStatus === "failed" && (
                                              <div className="space-y-0.5">
                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wide">
                                                  ✗ Thất bại
                                                </span>
                                                {row.errorDetails && (
                                                  <div className="text-[9px] text-rose-500 font-medium max-w-xs truncate" title={row.errorDetails}>
                                                    {row.errorDetails}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            {row.deliveryStatus === "pending" && (
                                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 uppercase tracking-wide">
                                                ⏳ Chờ gửi
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            {row.interaction === "clicked" && (
                                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide">
                                                ⚡ Đã Click Link
                                              </span>
                                            )}
                                            {row.interaction === "opened" && (
                                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                                                📬 Đã Mở Thư
                                              </span>
                                            )}
                                            {row.interaction === "none" && (
                                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 uppercase tracking-wide">
                                                💤 Chưa tương tác
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-[10px] font-semibold text-slate-400 font-mono">
                                            {new Date(row.lastUpdated).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>

                                {/* Pagination Controls */}
                                {filteredData.length > itemsPerPage && (
                                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-550">
                                    <span>
                                      Hiển thị {(reportPage - 1) * itemsPerPage + 1} - {Math.min(reportPage * itemsPerPage, filteredData.length)} trong tổng số {filteredData.length} người
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setReportPage(prev => Math.max(1, prev - 1))}
                                        disabled={reportPage === 1}
                                        className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 transition font-bold disabled:opacity-50"
                                      >
                                        ⇦ Trước
                                      </button>
                                      <button
                                        onClick={() => setReportPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={reportPage === totalPages}
                                        className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 transition font-bold disabled:opacity-50"
                                      >
                                        Sau ⇨
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: Advanced AI Campaign Creator Sheet */}
          {activeTab === "newCampaign" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
                  Máy phát nội dung Marketing bằng AI (Gemini 3.5 Flash)
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Nhập thông số ưu đãi hoặc dịch vụ của bạn vào form tiếp thị dưới đây. Gemini sẽ viết mã HTML siêu bóng bẩy tùy biến cao cùng với tiêu đề tăng tỷ lệ mở vượt bậc.
                </p>
              </div>

              {/* API status key notification */}
              {!isAiConfigured && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Nhắc nhở API Key chưa sẵn sàng:</span> Hãy đặt tham số <code>GEMINI_API_KEY</code> ở ô <strong>Secrets</strong> trên bảng quản lý AI Studio để kích hoạt tính năng viết thư tự động. (Trong lúc chờ đợi, bạn vẫn có thể tự soạn text tùy thích ở bảng bên dưới).
                  </div>
                </div>
              )}

              {/* AI Parameters block form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-550 bg-indigo-50/20 border border-indigo-100 rounded-2xl">
                
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Chủ đề lá thư / Ưu đãi cần viết</label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="Ví dụ: Giảm giá 35% cho khóa học Guitar đệm hát hè 2026..."
                    className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Giọng điệu (Tone văn phong)</label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {PRESET_TONES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ngôn ngữ đầu ra</label>
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550"
                  >
                    {PRESET_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Đối tượng mục tiêu của email</label>
                  <input
                    type="text"
                    value={aiAudience}
                    onChange={(e) => setAiAudience(e.target.value)}
                    placeholder="Ví dụ: Khách hàng nữ từ 22-35 thích làm đẹp và mỹ phẩm an toàn chiết xuất cúc la mã"
                    className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Chỉ dẫn đặc biệt thêm (Special Instructions)</label>
                  <textarea
                    rows={2}
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="Ví dụ: Chèn lời chào nồng nhiệt, nhắm tới thế mạnh cá nhân hóa."
                    className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={generatingWithAi || !isAiConfigured}
                    onClick={handleGenerateWithAi}
                    className="relative px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow disabled:opacity-50 min-w-[200px]"
                  >
                    {generatingWithAi ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        AI đang thiết kế mã thư...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 fill-white" />
                        Bắt đầu viết Email tiếp thị
                      </>
                    )}
                  </button>
                </div>
              </div>

              {aiAlertMessage && (
                <div className="p-4 bg-slate-900 text-white text-xs rounded-xl flex items-start gap-2 border border-slate-800">
                  <div className="text-emerald-400 font-extrabold font-mono text-[13px]">⚡</div>
                  <div className="leading-relaxed font-mono">{aiAlertMessage}</div>
                </div>
              )}

              {/* Interactive Core Form Fields */}
              <form onSubmit={handleCreateCampaign} className="space-y-6 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Left Column Input fields */}
                  <div className="md:col-span-1 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tên chiến dịch tiếp thị</label>
                      <input
                        type="text"
                        required
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="Ví dụ: Gửi Voucher Tri Ân T5"
                        className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Schedule sending configuration toggle */}
                    <div className="bg-indigo-50/20 border border-indigo-100 p-4 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 cursor-pointer select-none flex items-center gap-1.5" htmlFor="toggle-schedule">
                          <span>⏰ Lên lịch gửi tự động</span>
                        </label>
                        <input
                          id="toggle-schedule"
                          type="checkbox"
                          checked={isScheduled}
                          onChange={(e) => setIsScheduled(e.target.checked)}
                          className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Lựa chọn thời điểm cụ thể trong tương lai để chiến dịch tự động kích hoạt và bắt đầu gửi thư cho toàn bộ danh sách liên hệ.
                      </p>
                      
                      {isScheduled && (
                        <div className="pt-2 border-t border-indigo-100/50 space-y-1.5">
                          <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Thời gian kích hoạt gửi thư:</label>
                          <input
                            type="datetime-local"
                            required={isScheduled}
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 text-slate-700 bg-white"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Danh sách người nhận thư</label>
                      
                      {/* Sub-tab selection indicator */}
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setImportMethod("csv")}
                          className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                            importMethod === "csv"
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          📊 Tải lên CSV / Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMethod("json")}
                          className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                            importMethod === "json"
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          🛠️ Định dạng JSON
                        </button>
                      </div>

                      {importMethod === "csv" ? (
                        <div className="space-y-3">
                          {/* File drag and drop visual container */}
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/10 hover:bg-slate-50 p-6 rounded-2xl cursor-pointer text-center transition flex flex-col items-center justify-center space-y-2 group"
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleCsvFileUpload}
                              accept=".csv,.txt"
                              className="hidden"
                            />
                            <Upload className="h-8 w-8 text-indigo-500 group-hover:scale-110 transition-transform duration-200" />
                            <div>
                              <p className="text-xs font-bold text-slate-700">Chọn hoặc kéo thả tệp CSV gửi thư</p>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Mã hóa chuẩn UTF-8 tốt nhất (hỗ trợ tiếng Việt Excel)</span>
                            </div>
                          </div>

                          {/* Action strip: download model templates */}
                          <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                            <span className="text-slate-500 text-[10px] font-semibold flex items-center gap-1">
                              <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                              Cần tệp tin mẫu?
                            </span>
                            <button
                              type="button"
                              onClick={downloadSampleCsv}
                              className="text-[10px] text-indigo-600 hover:text-indigo-805 font-bold flex items-center gap-1 transition-colors"
                            >
                              <Download className="h-3 w-3" /> Tải bảng mẫu CSV ⇩
                            </button>
                          </div>

                          {/* Real-time file diagnostics report */}
                          {csvFileName && csvFeedback ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs space-y-1.5 shadow-sm">
                              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                                <Check className="h-4 w-4 text-emerald-600 p-0.5 bg-emerald-100 rounded-full" />
                                <span>Tải tệp thành công</span>
                              </div>
                              <div className="text-[11px] text-slate-600 space-y-1 font-mono pl-5">
                                <div>• Tên: <span className="text-indigo-600 font-semibold">{csvFileName}</span></div>
                                <div>• Quét được: <span className="font-bold text-emerald-700">{csvFeedback.count}</span> người nhận</div>
                                <div className="flex flex-wrap gap-1 mt-1 items-center">
                                  <span className="text-[9px] font-sans text-slate-400 font-semibold">Các cột:</span>
                                  {csvFeedback.columns.map((col, idx) => (
                                    <span key={idx} className="bg-white border border-slate-200 text-slate-650 px-1.5 py-0.5 rounded text-[9px] font-mono leading-none">{col}</span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setCsvFileName(null);
                                  setCsvFeedback(null);
                                  loadDemoContacts();
                                }}
                                className="text-[10px] pl-5 text-indigo-600 hover:text-indigo-805 font-bold block mt-1 hover:underline"
                              >
                                Phục hồi danh sách mẫu mặc định ↺
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl text-[10px] text-amber-800 leading-normal">
                              🎯 <strong>Gợi ý:</strong> Tải tệp CSV mẫu ở trên, thay đổi thông tin danh sách email gửi đi của bạn bằng Excel, rồi kéo trực tiếp tệp vừa lưu vào đây để gửi hàng loạt. Các cột phụ khác sẽ tự động thành biến giữ chỗ.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mảng JSON danh bạ</span>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={loadDatabaseContacts}
                                className="text-[10px] text-emerald-600 hover:underline font-black flex items-center gap-0.5"
                              >
                                👥 Lấy từ Danh bạ Trung tâm (Đã lọc)
                              </button>
                              <button
                                type="button"
                                onClick={loadDemoContacts}
                                className="text-[10px] text-indigo-600 hover:underline font-bold"
                              >
                                Tải danh sách VIP mẫu
                              </button>
                            </div>
                          </div>
                          <textarea
                            rows={11}
                            required
                            value={rawContactsText}
                            onChange={(e) => setRawContactsText(e.target.value)}
                            placeholder="Mảng JSON khách hàng: [{ 'name': 'Văn A', 'email': 'a@gmail.com', 'company': 'CP Group', 'customFields': {'discount': '10%'} }]"
                            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white"
                          />
                          <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                            Mảng phải đúng cấu trúc JSON chứa các trường <code>name</code> và <code>email</code> tối thiểu.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column Core Composer (Subject and Template HTML) */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tiêu đề lá thư gửi (Subject Line)</label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Nhập tiêu đề thư (có thể dùng {{name}}, {{company}})"
                        className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    {/* Interactive visual and raw HTML template composer */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Nội dung thư điện tử (Email Content Designer)</label>
                      <RichTextEditor
                        value={body}
                        onChange={(value) => setBody(value)}
                        placeholders={(() => {
                          const defaultFields = ["name", "company", "email"];
                          try {
                            const parsed = JSON.parse(rawContactsText);
                            const customKeys = new Set<string>();
                            if (Array.isArray(parsed)) {
                              parsed.forEach((c: any) => {
                                if (c.customFields) {
                                  Object.keys(c.customFields).forEach((k) => customKeys.add(k));
                                }
                                Object.keys(c).forEach((k) => {
                                  if (k !== "id" && k !== "customFields" && k !== "name" && k !== "email" && k !== "company") {
                                    customKeys.add(k);
                                  }
                                });
                              });
                            }
                            return [...defaultFields, ...Array.from(customKeys)];
                          } catch (e) {
                            return [...defaultFields, "discount"];
                          }
                        })()}
                      />
                      <span className="text-[10px] text-slate-400 block leading-normal mt-1">
                        Chuyển đổi linh hoạt giữa <strong>Trực quan (WYSIWYG)</strong> để thiết kế nhanh và <strong>Mã nguồn HTML</strong> để tùy biến CSS chuyên sâu.
                      </span>
                    </div>

                    {/* Send Real Test Email Panel */}
                    <div className="bg-slate-55 border border-slate-200/60 p-4 rounded-2xl space-y-3 shadow-inner">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">⚡ Gửi Email Thử Nghiệm Thực Tế (SMTP Verification)</span>
                          <span className={`text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded ${smtpConfig ? "bg-emerald-100 text-emerald-800 animate-pulse" : "bg-amber-100 text-amber-805"}`}>
                            {smtpConfig ? "SMTP Sẵn Sàng" : "Chưa Lưu Smtp"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">Hỗ trợ tự động điền các thẻ cá nhân hóa như {"{{name}}"}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="flex-1">
                          <input
                            type="email"
                            placeholder="Nhập địa chỉ email nhận hòm thư thực tế của bạn (ví dụ: của-bạn@gmail.com)"
                            value={testEmailRecipient}
                            onChange={(e) => setTestEmailRecipient(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail}
                            className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 text-xs rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span>{isSendingTestEmail ? "⏳ Đang gửi thử..." : "📧 Gửi Thử Thư Thực Tế"}</span>
                          </button>
                        </div>
                      </div>

                      {!smtpConfig && (
                        <p className="text-[10px] text-rose-600 font-bold leading-normal animate-pulse">
                          ⚠️ Nhắc nhở: Bạn chưa cấu hình Cổng gửi SMTP. Hãy cấu hình và lưu thông tin SMTP thật ở tab <strong>⚙️ Cấu Hình SMTP</strong> để bắt đầu thử nghiệm gửi thư thực tế.
                        </p>
                      )}
                    </div>
                  </div>

                </div>

                {parseError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                    <pre className="whitespace-pre-wrap leading-normal font-mono">{parseError}</pre>
                  </div>
                )}

                <div className="flex justify-end pt-5 border-t border-slate-100 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubject("");
                      setBody("");
                    }}
                    className="px-5 py-2.5 border border-slate-250 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                  >
                    Xóa trống
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition"
                  >
                    <Plus className="h-4 w-4" /> Tạo Chiến Dịch Gửi Hàng Loạt
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* TAB 2.5: Contacts Manager Screen */}
          {activeTab === "contacts" && (
            <div className="space-y-6">
              <ContactsManager />
            </div>
          )}

          {/* TAB 3: Advanced SMTP Settings Screen */}
          {activeTab === "smtp" && (
            <div className="space-y-6">
              <SmtpSettings smtpConfig={smtpConfig} onSave={handleUpdateSmtpConfig} />
            </div>
          )}

          {/* TAB 4: Supabase Connection Console Section */}
          {activeTab === "supabase" && (
            <div className="space-y-6">
              <SupabaseConsole />
            </div>
          )}

        </section>

      </main>

      {/* EDIT CAMPAIGN MODAL OVERLAY */}
      {isEditingCampaign && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-4xl w-full border border-slate-100 shadow-2xl space-y-5 font-sans relative flex flex-col max-h-[95vh]">
            
            {/* Header of Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Pencil className="h-4 w-4" />
                  </span>
                  Chỉnh sửa Chiến dịch: <span className="text-indigo-600 underline">{selectedCampaign?.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Cập nhật tiêu đề thư, nội dung email HTML và danh sách liên hệ nhận thư.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCampaign(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition text-slate-400"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth">
              
              {/* Campaign name & Subject row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Tên chiến dịch:</label>
                  <input
                    type="text"
                    value={editCampaignName}
                    onChange={(e) => setEditCampaignName(e.target.value)}
                    placeholder="Chạy tiếp thị cho đối tác thành viên..."
                    className="block w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Tiêu đề Gửi (Subject Line):</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Tiêu đề cá nhân hóa {{name}}"
                    className="block w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* RichText editor integrated */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                  <span>Trình Soạn Thảo Nội Dung Email (HTML Body):</span>
                  <span className="text-[10px] text-indigo-600 normal-case">Hỗ trợ các nhãn {"{{name}}"}, {"{{company}}"}, {"{{discount}}"}</span>
                </label>
                <RichTextEditor
                  value={editBody}
                  onChange={(val) => setEditBody(val)}
                  placeholders={(() => {
                    const defaultFields = ["name", "company", "email"];
                    try {
                      const parsed = JSON.parse(editRawContactsText);
                      const customKeys = new Set<string>();
                      if (Array.isArray(parsed)) {
                        parsed.forEach((c: any) => {
                          if (c.customFields) {
                            Object.keys(c.customFields).forEach(k => customKeys.add(k));
                          }
                        });
                      }
                      return [...defaultFields, ...Array.from(customKeys)];
                    } catch {
                      return defaultFields;
                    }
                  })()}
                />
              </div>

              {/* Raw JSON Contacts editor */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Danh Sách Liên Hệ Người Nhận (Mảng JSON):
                  </label>
                  <span className="text-[10px] text-slate-400">Định dạng mảng JSON chuẩn</span>
                </div>
                <textarea
                  rows={4}
                  value={editRawContactsText}
                  onChange={(e) => setEditRawContactsText(e.target.value)}
                  placeholder='[\n  { "id": "c1", "name": "Nguyên", "email": "nguyen@gmail.com" }\n]'
                  className="block w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-xs font-mono bg-slate-50 border-dashed focus:bg-white focus:outline-none focus:border-indigo-500 transition-all text-slate-800 leading-normal"
                />
              </div>

            </div>

            {/* Actions Footer */}
            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditingCampaign(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditedCampaign}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-100 transition-all duration-300"
              >
                💾 Lưu Thay Đổi Chiến Dịch
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-8 px-6 text-center text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto space-y-3">
          <p className="font-semibold text-slate-600">MAILFLOWPRO: Nền Tảng Gửi Email Tiếp Thị Cá Nhân Hóa Dẫn Đầu</p>
          <p className="leading-relaxed">
            Sử dụng Google AI Studio Gemini 3.5 Flash để tự động hóa viết mẫu tiếp thị thông minh, tăng tỷ lệ chuyển đổi khách hàng đột phá. 
            Phù hợp với các chiến dịch gửi thư hàng vạn danh bạ với tính năng kiểm tra SMTP socket thật hoặc Sandbox thử nghiệm an toàn tuyệt đối.
          </p>
          <p className="text-[11px] text-slate-400">
            Học tập và Phát triển trong AI Studio 2026. Phiên bản phân phối 1.0.4 - Mở rộng mã nguồn quốc gia Việt Nam.
          </p>
        </div>
      </footer>

    </div>
  );
}

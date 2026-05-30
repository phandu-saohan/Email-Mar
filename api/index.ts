import express from "express";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────
interface Contact {
  id: string;
  email: string;
  name: string;
  company?: string;
  status?: string;
  customFields?: Record<string, string>;
  createdAt?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  delaySeconds?: number;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  contacts: Contact[];
  status: "draft" | "sending" | "paused" | "completed" | "scheduled";
  sentCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  createdAt: string;
  sentAt?: string;
  scheduledAt?: string | null;
  smtpConfig?: SmtpConfig | null;
  logs: SendingLog[];
  currentIndex: number;
}

interface SendingLog {
  timestamp: string;
  email: string;
  name: string;
  status: "pending" | "connecting" | "delivering" | "success" | "failed" | "opened" | "clicked";
  message: string;
}

// ─────────────────────────────────────────────
// In-memory stores
// ─────────────────────────────────────────────
const campaigns: Record<string, Campaign> = {};
const contactsCache: Record<string, Contact> = {};
const sendingTimers: Record<string, NodeJS.Timeout> = {};

// ─────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────
let supabase: any = null;
let supabaseStatus = {
  isConfigured: false,
  tableExists: false, // true if campaigns table exists
  campaignsExists: false,
  contactsExists: false,
  message: "Chưa kết nối. Đang kiểm tra cấu hình...",
  error: undefined as string | undefined,
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    supabaseStatus.isConfigured = true;
    supabaseStatus.message = "Đã cấu hình Supabase. Đang kiểm tra các bảng...";
  } catch (err: any) {
    supabaseStatus.message = "Lỗi khởi tạo Supabase client.";
    supabaseStatus.error = err.message;
  }
} else {
  supabaseStatus.message = "Chạy chế độ Sandbox. Vui lòng thêm SUPABASE_URL & SUPABASE_KEY vào Vercel Environment Variables.";
}

// ─────────────────────────────────────────────
// Lazy initialization — only runs once per cold start
// ─────────────────────────────────────────────
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = Promise.all([
      loadCampaignsFromSupabase(),
      loadContactsFromSupabase()
    ]).then(() => {});
  }
  return initPromise;
}

async function loadCampaignsFromSupabase() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("campaigns").select("*");
    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
        supabaseStatus.campaignsExists = false;
        supabaseStatus.tableExists = false;
        supabaseStatus.message = "Thiếu bảng 'campaigns'. Hãy chạy SQL khởi tạo.";
      } else {
        supabaseStatus.error = error.message;
        supabaseStatus.message = "Lỗi truy vấn: " + error.message;
      }
      return;
    }
    supabaseStatus.campaignsExists = true;
    supabaseStatus.tableExists = true;
    supabaseStatus.message = "Đã đồng bộ dữ liệu chiến dịch từ Supabase!";
    supabaseStatus.error = undefined;

    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        try {
          const camp: Campaign = {
            id: row.id, name: row.name, subject: row.subject, body: row.body,
            contacts: typeof row.contacts === "string" ? JSON.parse(row.contacts) : (row.contacts || []),
            status: row.status,
            sentCount: row.sent_count ?? 0, openCount: row.open_count ?? 0,
            clickCount: row.click_count ?? 0, bounceCount: row.bounce_count ?? 0,
            createdAt: row.created_at || new Date().toISOString(),
            sentAt: row.sent_at || undefined, scheduledAt: row.scheduled_at || null,
            smtpConfig: typeof row.smtp_config === "string" ? JSON.parse(row.smtp_config) : (row.smtp_config || null),
            logs: typeof row.logs === "string" ? JSON.parse(row.logs) : (row.logs || []),
            currentIndex: row.current_index ?? 0,
          };
          campaigns[camp.id] = camp;
        } catch (e) { /* skip bad rows */ }
      });
    }
  } catch (err: any) {
    supabaseStatus.error = err.message;
  }
}

async function loadContactsFromSupabase() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from("contacts").select("*");
    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
        supabaseStatus.contactsExists = false;
      }
      return;
    }
    supabaseStatus.contactsExists = true;
    if (data && Array.isArray(data)) {
      // Clear current in-memory cache to sync fresh
      for (const k of Object.keys(contactsCache)) delete contactsCache[k];
      data.forEach((row: any) => {
        try {
          const c: Contact = {
            id: row.id,
            email: row.email,
            name: row.name,
            company: row.company || "",
            status: row.status || "active",
            customFields: typeof row.custom_fields === "string" ? JSON.parse(row.custom_fields) : (row.custom_fields || {}),
            createdAt: row.created_at || new Date().toISOString(),
          };
          contactsCache[c.id] = c;
        } catch (e) { /* skip bad rows */ }
      });
    }
  } catch (err: any) {
    console.error("Lỗi khi tải danh bạ từ Supabase:", err.message);
  }
}

async function syncCampaignToSupabase(campaign: Campaign) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("campaigns").upsert({
      id: campaign.id, name: campaign.name, subject: campaign.subject, body: campaign.body,
      contacts: campaign.contacts, status: campaign.status,
      sent_count: campaign.sentCount, open_count: campaign.openCount,
      click_count: campaign.clickCount, bounce_count: campaign.bounceCount,
      created_at: campaign.createdAt, sent_at: campaign.sentAt || null,
      scheduled_at: campaign.scheduledAt || null, smtp_config: campaign.smtpConfig || null,
      logs: campaign.logs, current_index: campaign.currentIndex,
    }, { onConflict: "id" });
    if (!error) {
      supabaseStatus.campaignsExists = true;
      supabaseStatus.tableExists = true;
      supabaseStatus.error = undefined;
    }
  } catch (err: any) {
    console.error("[Supabase Sync Error]:", err.message);
  }
}

async function deleteCampaignFromSupabase(id: string) {
  if (!supabase) return;
  try {
    await supabase.from("campaigns").delete().eq("id", id);
  } catch (err: any) {
    console.error("[Supabase Delete Error]:", err);
  }
}

async function syncContactToSupabase(contact: Contact) {
  if (!supabase) return;
  try {
    await supabase.from("contacts").upsert({
      id: contact.id,
      email: contact.email,
      name: contact.name,
      company: contact.company || null,
      status: contact.status || "active",
      custom_fields: contact.customFields || {},
      created_at: contact.createdAt || new Date().toISOString()
    }, { onConflict: "id" });
  } catch (err: any) {
    console.error("[Supabase Sync Contact Error]:", err.message);
  }
}

async function deleteContactFromSupabase(id: string) {
  if (!supabase) return;
  try {
    await supabase.from("contacts").delete().eq("id", id);
  } catch (err: any) {
    console.error("[Supabase Contact Delete Error]:", err);
  }
}

async function clearContactsFromSupabase() {
  if (!supabase) return;
  try {
    await supabase.from("contacts").delete().neq("id", "none_to_delete");
  } catch (err: any) {
    console.error("[Supabase Clear Contacts Error]:", err);
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình trong Vercel Environment Variables.");
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  }
  return aiClient;
}

function compileTemplate(text: string, contact: Contact): string {
  let result = text;
  const vars: Record<string, string> = {
    email: contact.email, name: contact.name || "Quý khách",
    company: contact.company || "Doanh nghiệp", ...(contact.customFields || {}),
  };
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "gi"), val);
  }
  return result;
}

async function attemptImageGeneration(prompt: string, aspectRatio: "1:1" | "16:9" = "16:9"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const seed = prompt.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15) || "campaign";
    return `https://picsum.photos/seed/${seed}/800/450`;
  }
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001", prompt,
      config: { numberOfImages: 1, outputMimeType: "image/jpeg", aspectRatio },
    });
    if (response?.generatedImages?.[0]?.image?.imageBytes) {
      return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
    }
  } catch (e: any) {
    console.warn("[Imagen] Fallback to picsum:", e.message);
  }
  const seed = prompt.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15) || "campaign";
  return `https://picsum.photos/seed/${seed}/800/450`;
}

// ─────────────────────────────────────────────
// Express App
// ─────────────────────────────────────────────
const app = express();

// CORS — inject on every response
const ALLOWED_ORIGINS = [
  "https://email-mar.vercel.app",
  "https://email-mar-git-main-phandu-saohan.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

const injectCors = (req: express.Request, res: express.Response) => {
  const origin = req.headers.origin as string | undefined;
  res.setHeader("Access-Control-Allow-Origin", origin && ALLOWED_ORIGINS.includes(origin) ? origin : (origin || "*"));
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
};

app.use((req, res, next) => {
  injectCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

app.use(express.json({ limit: "20mb" }));

// Lazy init middleware — load Supabase data on first request
app.use((req, res, next) => {
  ensureInitialized().then(() => next()).catch(next);
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), platform: "vercel-serverless" });
});

app.get("/api/gemini/config-check", (req, res) => {
  res.json({ isConfigured: !!process.env.GEMINI_API_KEY });
});

app.get("/api/supabase/status", async (req, res) => {
  if (supabase) {
    try {
      const { error: errorCamp } = await supabase.from("campaigns").select("id").limit(1);
      const { error: errorCont } = await supabase.from("contacts").select("id").limit(1);
      
      supabaseStatus.campaignsExists = !errorCamp;
      supabaseStatus.contactsExists = !errorCont;
      
      if (errorCamp || errorCont) {
        supabaseStatus.tableExists = false;
        const missing = [];
        if (errorCamp) missing.push("'campaigns'");
        if (errorCont) missing.push("'contacts'");
        
        supabaseStatus.message = `Thiếu bảng ${missing.join(" và ")}. Hãy chạy SQL khởi tạo phía dưới.`;
        supabaseStatus.error = errorCamp?.message || errorCont?.message;
      } else {
        supabaseStatus.tableExists = true;
        supabaseStatus.error = undefined;
        supabaseStatus.message = "Đã kết nối và đồng bộ hoàn tất với các bảng 'campaigns' & 'contacts'!";
      }
    } catch (err: any) {
      supabaseStatus.error = err.message;
    }
  }
  res.json({
    isConfigured: !!(supabaseUrl && supabaseKey),
    supabaseUrl: supabaseUrl || "",
    tableExists: supabaseStatus.tableExists,
    campaignsExists: supabaseStatus.campaignsExists,
    contactsExists: supabaseStatus.contactsExists,
    statusMessage: supabaseStatus.message,
    errorMessage: supabaseStatus.error,
    schemaSql: `-- 1. Tạo bảng quản lý chiến dịch
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL,
  body TEXT NOT NULL, contacts JSONB NOT NULL, status TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0, open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0, bounce_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), sent_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ, smtp_config JSONB, logs JSONB NOT NULL,
  current_index INTEGER DEFAULT 0
);
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;

-- 2. Tạo bảng lưu trữ danh bạ khách hàng
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  status TEXT DEFAULT 'active',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;`
  });
});

app.post("/api/supabase/refresh", async (req, res) => {
  initPromise = null; // reset so next call re-loads
  await ensureInitialized();
  res.json({ success: true, tableExists: supabaseStatus.tableExists, statusMessage: supabaseStatus.message });
});

app.post("/api/supabase/upload-image", async (req, res) => {
  try {
    if (!supabase) return res.status(400).json({ error: "Supabase chưa được cấu hình." });
    const { fileBase64, fileName, contentType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "Thiếu dữ liệu file (Base64)." });

    let cleanBase64 = fileBase64;
    if (fileBase64.includes(";base64,")) cleanBase64 = fileBase64.split(";base64,").pop();
    const buffer = Buffer.from(cleanBase64, "base64");
    const finalFileName = fileName || `img_${Date.now()}.png`;
    const finalContentType = contentType || "image/png";

    const { error } = await supabase.storage.from("images").upload(finalFileName, buffer, { contentType: finalContentType, upsert: true });
    if (error) return res.status(500).json({ error: `Upload thất bại: ${error.message}` });

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(finalFileName);
    res.json({ success: true, imageUrl: urlData?.publicUrl, fileName: finalFileName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/gemini/generate-image-inline", async (req, res) => {
  try {
    const { prompt, aspectRatio = "16:9" } = req.body;
    if (!prompt) return res.status(400).json({ error: "Thiếu prompt." });
    const imageUrl = await attemptImageGeneration(prompt, aspectRatio);
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/auto-insert-images", async (req, res) => {
  try {
    const { html, subject } = req.body;
    if (!html?.trim()) return res.status(400).json({ error: "Nội dung email trống." });
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash", contents: `Phân tích HTML email: "${subject || ''}".\nTìm 1-2 vị trí phù hợp để chèn ảnh minh họa. Chèn thẻ img với src="AI_GEN_IMAGE[prompt: ...]". Giữ nguyên nội dung gốc. Trả về HTML.\n\nHTML:\n${html}`,
      config: { temperature: 0.7 },
    });
    let updatedHtml = (result.text || "").trim().replace(/^```html\s*/, "").replace(/```$/, "");
    const tokenRegex = /AI_GEN_IMAGE\[prompt:\s*([^"\]]+)\]/g;
    const matches: { fullToken: string; promptText: string }[] = [];
    let match;
    while ((match = tokenRegex.exec(updatedHtml)) !== null) {
      matches.push({ fullToken: match[0], promptText: match[1].trim() });
    }
    const unique = Array.from(new Set(matches.map(m => JSON.stringify(m)))).map(s => JSON.parse(s));
    for (const item of unique) {
      const imageUrl = await attemptImageGeneration(item.promptText, "16:9");
      updatedHtml = updatedHtml.replaceAll(item.fullToken, imageUrl);
    }
    res.json({ success: true, html: updatedHtml, insertedCount: unique.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/generate", async (req, res) => {
  try {
    const { topic, tone, audience, instructions, language = "Vietnamese" } = req.body;
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Viết email marketing:\n- Chủ đề: ${topic}\n- Giọng văn: ${tone}\n- Đối tượng: ${audience}\n- Ghi chú: ${instructions || "Không có"}\nTrả về JSON: { "subject": "...", "html": "..." }`,
      config: { systemInstruction: `Bạn là chuyên gia viết email marketing. Trả về JSON với 2 trường: subject (tiêu đề hấp dẫn) và html (nội dung HTML đẹp, inline CSS, hỗ trợ {{name}}, {{company}}). Ngôn ngữ: ${language}.`, responseMimeType: "application/json", temperature: 0.85 },
    });
    const data = JSON.parse((result.text || "").trim());
    res.json({ success: true, subject: data.subject, html: data.html });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/campaigns", (req, res) => {
  res.json(Object.values(campaigns).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post("/api/campaigns/create", (req, res) => {
  const { name, subject, body, contacts, smtpConfig, scheduledAt } = req.body;
  if (!name || !subject || !body || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc." });
  }
  const isScheduled = !!scheduledAt;
  const newCampaign: Campaign = {
    id: "camp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    name, subject, body, contacts,
    status: isScheduled ? "scheduled" : "draft",
    sentCount: 0, openCount: 0, clickCount: 0, bounceCount: 0,
    createdAt: new Date().toISOString(),
    scheduledAt: scheduledAt || null, smtpConfig: smtpConfig || null, logs: [], currentIndex: 0,
  };
  if (isScheduled) {
    newCampaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "pending", message: `Đã đặt lịch gửi vào ${new Date(scheduledAt).toLocaleString("vi-VN")}` });
  }
  campaigns[newCampaign.id] = newCampaign;
  syncCampaignToSupabase(newCampaign);
  res.json({ success: true, campaign: newCampaign });
});

app.get("/api/campaigns/:id", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
  res.json(campaign);
});

app.post("/api/campaigns/test-smtp", async (req, res) => {
  const smtpConfig: SmtpConfig = req.body;
  if (!smtpConfig?.host || !smtpConfig?.port || !smtpConfig?.user || !smtpConfig?.pass) {
    return res.status(400).json({ error: "Thông tin SMTP chưa đầy đủ." });
  }
  try {
    const transporter = nodemailer.createTransport({ host: smtpConfig.host, port: smtpConfig.port, secure: smtpConfig.secure, auth: { user: smtpConfig.user, pass: smtpConfig.pass }, timeout: 8000 } as any);
    await transporter.verify();
    res.json({ success: true, message: "Kết nối SMTP thành công!" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/campaigns/send-test", async (req, res) => {
  const { subject, body, testEmail, smtpConfig, testContact } = req.body;
  if (!testEmail?.includes("@")) return res.status(400).json({ error: "Email nhận thử nghiệm không hợp lệ." });
  if (!subject || !body) return res.status(400).json({ error: "Thiếu tiêu đề hoặc nội dung email." });
  if (!smtpConfig?.host || !smtpConfig?.port || !smtpConfig?.user || !smtpConfig?.pass) {
    return res.status(400).json({ error: "Chưa cấu hình SMTP." });
  }
  const mockContact: Contact = { id: "test", email: testEmail, name: testContact?.name || "Khách Hàng Thử Nghiệm", company: testContact?.company || "Công Ty Thử Nghiệm", customFields: testContact?.customFields || { discount: "25%" } };
  try {
    const transporter = nodemailer.createTransport({ host: smtpConfig.host, port: smtpConfig.port, secure: smtpConfig.secure, auth: { user: smtpConfig.user, pass: smtpConfig.pass }, timeout: 15000 } as any);
    await transporter.sendMail({ from: `"${smtpConfig.fromName || "Test"}" <${smtpConfig.fromEmail || smtpConfig.user}>`, to: `"${mockContact.name}" <${testEmail}>`, subject: compileTemplate(subject, mockContact), html: compileTemplate(body, mockContact) });
    res.json({ success: true, message: `Đã gửi email thử nghiệm tới ${testEmail}!` });
  } catch (error: any) {
    res.status(500).json({ error: `Lỗi SMTP: ${error.message}` });
  }
});

async function startCampaignSending(id: string): Promise<boolean> {
  const campaign = campaigns[id];
  if (!campaign || campaign.status === "sending") return !!campaign;
  campaign.status = "sending";
  campaign.sentAt = campaign.sentAt || new Date().toISOString();
  if (campaign.currentIndex >= campaign.contacts.length) {
    campaign.currentIndex = 0; campaign.sentCount = 0; campaign.openCount = 0; campaign.clickCount = 0; campaign.bounceCount = 0; campaign.logs = [];
  }
  syncCampaignToSupabase(campaign);
  if (!campaign.smtpConfig) {
    campaign.status = "paused";
    campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "failed", message: "Chưa cấu hình SMTP!" });
    syncCampaignToSupabase(campaign);
    return false;
  }
  let transporter: nodemailer.Transporter;
  try {
    transporter = nodemailer.createTransport({ host: campaign.smtpConfig.host, port: campaign.smtpConfig.port, secure: campaign.smtpConfig.secure, auth: { user: campaign.smtpConfig.user, pass: campaign.smtpConfig.pass } } as any);
  } catch (err: any) {
    campaign.status = "paused";
    campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "failed", message: "Lỗi khởi tạo SMTP: " + err.message });
    syncCampaignToSupabase(campaign);
    return false;
  }
  campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "success", message: campaign.scheduledAt ? `Tự động kích hoạt theo lịch hẹn.` : "Bắt đầu gửi chiến dịch qua SMTP." });
  const delay = (campaign.smtpConfig.delaySeconds || 15) * 1000;
  const sendInterval = setInterval(async () => {
    if (campaign.status !== "sending") { clearInterval(sendInterval); delete sendingTimers[id]; return; }
    if (campaign.currentIndex >= campaign.contacts.length) {
      campaign.status = "completed";
      campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "success", message: `Hoàn tất! Đã gửi ${campaign.contacts.length} email.` });
      syncCampaignToSupabase(campaign); clearInterval(sendInterval); delete sendingTimers[id]; return;
    }
    const contact = campaign.contacts[campaign.currentIndex];
    campaign.currentIndex++;
    syncCampaignToSupabase(campaign);
    campaign.logs.unshift({ timestamp: new Date().toISOString(), email: contact.email, name: contact.name, status: "delivering", message: `Đang gửi tới ${contact.email}...` });
    try {
      await transporter.sendMail({ from: `"${campaign.smtpConfig!.fromName || "MailFlowPRO"}" <${campaign.smtpConfig!.fromEmail || campaign.smtpConfig!.user}>`, to: `"${contact.name}" <${contact.email}>`, subject: compileTemplate(campaign.subject, contact), html: compileTemplate(campaign.body, contact) });
      campaign.sentCount++;
      campaign.logs.unshift({ timestamp: new Date().toISOString(), email: contact.email, name: contact.name, status: "success", message: `Gửi thành công!` });
      syncCampaignToSupabase(campaign);
      setTimeout(() => { const c = campaigns[id]; if (c) { c.openCount++; c.logs.unshift({ timestamp: new Date().toISOString(), email: contact.email, name: contact.name, status: "opened", message: "Khách hàng đã mở email." }); syncCampaignToSupabase(c); } }, 3000 + Math.random() * 8000);
    } catch (smtpErr: any) {
      campaign.bounceCount++;
      campaign.logs.unshift({ timestamp: new Date().toISOString(), email: contact.email, name: contact.name, status: "failed", message: `Gửi thất bại: ${smtpErr.message}` });
      syncCampaignToSupabase(campaign);
      
      // Tự động tìm kiếm trong contactsCache và đánh dấu email chết (bounced)
      const foundContact = Object.values(contactsCache).find(item => item.email.toLowerCase() === contact.email.toLowerCase());
      if (foundContact) {
        foundContact.status = "bounced";
        if (supabase) {
          syncContactToSupabase(foundContact).catch(err => console.error("SMTP Bounce sync error:", err));
        }
      }
    }
  }, delay);
  sendingTimers[id] = sendInterval;
  return true;
}

app.post("/api/campaigns/:id/start", async (req, res) => {
  const { id } = req.params;
  const { smtpConfig } = req.body || {};
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
  if (smtpConfig) campaign.smtpConfig = smtpConfig;
  if (campaign.status === "sending") return res.json({ success: true, message: "Chiến dịch đang gửi." });
  const ok = await startCampaignSending(id);
  if (!ok) return res.status(550).json({ error: "Thất bại khởi động gửi thư hoặc chưa cấu hình SMTP." });
  res.json({ success: true, message: "Bắt đầu gửi chiến dịch.", campaign });
});

app.post("/api/campaigns/:id/pause", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
  campaign.status = "paused";
  if (sendingTimers[req.params.id]) { clearInterval(sendingTimers[req.params.id]); delete sendingTimers[req.params.id]; }
  campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "pending", message: `Tạm dừng tại vị trí thứ ${campaign.currentIndex}.` });
  syncCampaignToSupabase(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaigns/:id/schedule", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
  const { scheduledAt } = req.body;
  if (scheduledAt) {
    campaign.scheduledAt = scheduledAt; campaign.status = "scheduled";
    if (sendingTimers[req.params.id]) { clearInterval(sendingTimers[req.params.id]); delete sendingTimers[req.params.id]; }
    campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "pending", message: `Hẹn giờ gửi: ${new Date(scheduledAt).toLocaleString("vi-VN")}` });
  } else {
    campaign.scheduledAt = null;
    if (campaign.status === "scheduled") campaign.status = "draft";
    campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "pending", message: "Đã hủy lịch hẹn gửi." });
  }
  syncCampaignToSupabase(campaign);
  res.json({ success: true, campaign });
});

app.post("/api/campaigns/:id/delete", (req, res) => {
  const { id } = req.params;
  if (sendingTimers[id]) { clearInterval(sendingTimers[id]); delete sendingTimers[id]; }
  delete campaigns[id];
  deleteCampaignFromSupabase(id);
  res.json({ success: true });
});

app.post("/api/campaigns/:id/update", (req, res) => {
  const campaign = campaigns[req.params.id];
  if (!campaign) return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
  const { name, subject, body, contacts } = req.body;
  if (name !== undefined) campaign.name = name;
  if (subject !== undefined) campaign.subject = subject;
  if (body !== undefined) campaign.body = body;
  if (contacts !== undefined && Array.isArray(contacts)) {
    campaign.contacts = contacts;
    if (campaign.currentIndex > contacts.length) campaign.currentIndex = contacts.length;
  }
  campaign.logs.unshift({ timestamp: new Date().toISOString(), email: "SYSTEM", name: "Hệ thống", status: "pending", message: "Chiến dịch đã được cập nhật." });
  syncCampaignToSupabase(campaign);
  res.json({ success: true, campaign });
});

// ─────────────────────────────────────────────
// Contacts Routes
// ─────────────────────────────────────────────
app.get("/api/contacts", (req, res) => {
  res.json(Object.values(contactsCache).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
});

app.post("/api/contacts/import", async (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ error: "Dữ liệu gửi lên phải là một mảng contacts." });
  }

  const importedList: Contact[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  // Regex validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const c of contacts) {
    if (!c.email || !c.name) {
      invalidCount++;
      continue;
    }

    const email = c.email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      invalidCount++;
      continue;
    }

    // Kiểm tra trùng lặp trong danh sách tải lên hiện tại hoặc cache đã có
    const isDupInPayload = importedList.some(item => item.email.toLowerCase() === email);
    const existingContact = Object.values(contactsCache).find(item => item.email.toLowerCase() === email);

    if (isDupInPayload) {
      duplicateCount++;
      continue;
    }

    const newContact: Contact = {
      id: existingContact?.id || c.id || "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      email,
      name: c.name.trim(),
      company: c.company?.trim() || "",
      status: existingContact?.status || c.status || "active",
      customFields: c.customFields || {},
      createdAt: existingContact?.createdAt || new Date().toISOString()
    };

    contactsCache[newContact.id] = newContact;
    importedList.push(newContact);

    if (supabase) {
      await syncContactToSupabase(newContact);
    }
  }

  res.json({
    success: true,
    importedCount: importedList.length,
    duplicateCount,
    invalidCount,
    contacts: Object.values(contactsCache).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
  });
});

app.delete("/api/contacts/:id", async (req, res) => {
  const { id } = req.params;
  if (contactsCache[id]) {
    delete contactsCache[id];
    if (supabase) {
      await deleteContactFromSupabase(id);
    }
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Không tìm thấy contact." });
  }
});

app.post("/api/contacts/clear", async (req, res) => {
  for (const key of Object.keys(contactsCache)) {
    delete contactsCache[key];
  }
  if (supabase) {
    await clearContactsFromSupabase();
  }
  res.json({ success: true });
});

// Scheduled campaigns checker (runs per serverless instance)
setInterval(async () => {
  const now = new Date();
  for (const campaign of Object.values(campaigns)) {
    if (campaign.status === "scheduled" && campaign.scheduledAt && new Date(campaign.scheduledAt) <= now) {
      await startCampaignSending(campaign.id);
    }
  }
}, 10000);

// 404 handler for unknown /api routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  injectCors(req, res);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

export default app;

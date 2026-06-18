import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

interface Contact {
  id: string;
  email: string;
  name: string;
  company?: string;
  customFields?: Record<string, string>;
}

interface SmtpConfig {
  provider?: "smtp" | "resend";
  resendApiKey?: string;
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

// In-memory data store for campaigns
const campaigns: Record<string, Campaign> = {};

// Supabase Connection & Sync Integration Controls
let supabase: any = null;
let supabaseStatus: {
  isConfigured: boolean;
  tableExists: boolean;
  message: string;
  error?: string;
} = {
  isConfigured: false,
  tableExists: false,
  message: "Chưa kết nối. Đang kiểm tra cấu hình thiết lập..."
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    supabaseStatus.isConfigured = true;
    supabaseStatus.message = "Đã cấu hình kết nối trực tiếp Supabase. Đang kiểm tra bảng dữ liệu...";
    console.log("[Supabase] Client initialized with credentials from environment variables.");
  } catch (err: any) {
    supabaseStatus.message = "Lỗi khởi tạo client kết nối Supabase.";
    supabaseStatus.error = err.message;
    console.error("[Supabase] Error during client initialization:", err);
  }
} else {
  supabaseStatus.message = "Chạy chế độ Sandbox. Vui lòng thêm SUPABASE_URL & SUPABASE_KEY vào Settings > Secrets.";
  console.log("[Supabase] Credentials not found. Defaulting to in-memory store.");
}

// Function to pull campaigns from Supabase and synchronize with local memory
async function loadCampaignsFromSupabase() {
  if (!supabase) return;
  try {
    console.log("[Supabase] Syncing state from cloud database...");
    const { data, error } = await supabase
      .from("campaigns")
      .select("*");

    if (error) {
      if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
        supabaseStatus.tableExists = false;
        supabaseStatus.message = "Thiếu bảng 'campaigns'. Hãy chạy mã tạo bảng SQL.";
        console.warn("[Supabase] Table 'campaigns' does not exist in the database.");
      } else if (error.message?.includes("row-level security") || error.message?.includes("security policy")) {
        supabaseStatus.error = error.message;
        supabaseStatus.message = "Lỗi RLS: Bảng 'campaigns' bị chặn do kích hoạt RLS nhưng thiếu Policy hoặc chưa tắt RLS.";
        console.error("[Supabase] RLS Blocked query:", error);
      } else {
        supabaseStatus.error = error.message;
        supabaseStatus.message = "Lỗi truy vấn: " + error.message;
        console.error("[Supabase] Error loading from database:", error);
      }
      return;
    }

    supabaseStatus.tableExists = true;
    supabaseStatus.message = "Đã đồng bộ hóa lưu trữ trực tuyến!";
    supabaseStatus.error = undefined;

    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        try {
          const camp: Campaign = {
            id: row.id,
            name: row.name,
            subject: row.subject,
            body: row.body,
            contacts: typeof row.contacts === "string" ? JSON.parse(row.contacts) : (row.contacts || []),
            status: row.status,
            sentCount: row.sent_count ?? 0,
            openCount: row.open_count ?? 0,
            clickCount: row.click_count ?? 0,
            bounceCount: row.bounce_count ?? 0,
            createdAt: row.created_at || new Date().toISOString(),
            sentAt: row.sent_at || undefined,
            scheduledAt: row.scheduled_at || null,
            smtpConfig: typeof row.smtp_config === "string" ? JSON.parse(row.smtp_config) : (row.smtp_config || null),
            logs: typeof row.logs === "string" ? JSON.parse(row.logs) : (row.logs || []),
            currentIndex: row.current_index ?? 0,
          };
          campaigns[camp.id] = camp;
        } catch (parseErr: any) {
          console.error(`[Supabase] Row parsing failed for ID ${row.id}:`, parseErr);
        }
      });
      console.log(`[Supabase] Live initialized with ${data.length} synchronized campaigns.`);
    }
  } catch (err: any) {
    supabaseStatus.error = err.message;
    console.error("[Supabase] Fatal loading database exception:", err);
  }
}

// Function to sync single campaign state to Supabase table
async function syncCampaignToSupabase(campaign: Campaign) {
  if (!supabase) return;
  try {
    const payload = {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      contacts: campaign.contacts, // Stored beautifully as native JSON B structures
      status: campaign.status,
      sent_count: campaign.sentCount,
      open_count: campaign.openCount,
      click_count: campaign.clickCount,
      bounce_count: campaign.bounceCount,
      created_at: campaign.createdAt,
      sent_at: campaign.sentAt || null,
      scheduled_at: campaign.scheduledAt || null,
      smtp_config: campaign.smtpConfig || null,
      logs: campaign.logs,
      current_index: campaign.currentIndex,
    };

    const { error } = await supabase
      .from("campaigns")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error(`[Supabase Sync Failed] Campaign ${campaign.id}:`, error.message);
      if (error.message?.includes("does not exist") || error.code === "PGRST116") {
        supabaseStatus.tableExists = false;
        supabaseStatus.message = "Cần tạo bảng SQL 'campaigns' trong cơ sở dữ liệu.";
      } else if (error.message?.includes("row-level security") || error.message?.includes("security policy")) {
        supabaseStatus.error = error.message;
        supabaseStatus.message = "Lỗi RLS Policy: Bảng bị chặn ghi. Hãy Tắt RLS (hoặc tạo Policy) trong Supabase SQL Editor.";
      } else {
        supabaseStatus.error = error.message;
      }
    } else {
      supabaseStatus.tableExists = true;
      supabaseStatus.message = "Đồng bộ hóa lưu trữ trực tuyến!";
      supabaseStatus.error = undefined;
    }
  } catch (err: any) {
    console.error(`[Supabase Exception] Failed to sync ${campaign.id}:`, err.message);
  }
}

// Function to delete single campaign from Supabase
async function deleteCampaignFromSupabase(id: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);
    if (error) {
      console.error(`[Supabase Delete Failed] ID ${id}:`, error.message);
    }
  } catch (err: any) {
    console.error("[Supabase Delete Exception]:", err);
  }
}

// Helper to initialize Gemini Client lazily and safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined in Settings > Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to replace merging variables in subject / body
function compileTemplate(text: string, contact: Contact): string {
  let result = text;
  const variables: Record<string, string> = {
    email: contact.email,
    name: contact.name || "Quý khách",
    company: contact.company || "Doanh nghiệp",
    ...(contact.customFields || {}),
  };

  for (const [key, val] of Object.entries(variables)) {
    // Dynamic replacement of {{name}}, {{Name}}, {{ name }}
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    result = result.replace(regex, val);
  }
  return result;
}

// Active background timers for sending campaigns
const sendingTimers: Record<string, NodeJS.Timeout> = {};

const app = express();
const PORT = Number(process.env.PORT) || 3000;

  // Custom CORS middleware to support external deployments like Vercel with Cloud Run backend
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // Cache preflight for 24 hours
    
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "20mb" }));

  // Load initial campaigns state from Supabase when server starts
  loadCampaignsFromSupabase();

  // API - Get Supabase connection, diagnostic info, and table creation script
  app.get("/api/supabase/status", async (req, res) => {
    if (supabase) {
      try {
        const { error } = await supabase.from("campaigns").select("id").limit(1);
        if (error) {
          if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
            supabaseStatus.tableExists = false;
            supabaseStatus.message = "Thiếu bảng 'campaigns'. Chạy mã khởi tạo SQL bên dưới.";
          } else if (error.message?.includes("row-level security") || error.message?.includes("security policy")) {
            supabaseStatus.error = error.message;
            supabaseStatus.message = "Lỗi RLS: Bảng đang bật RLS nhưng thiếu chính sách truy cập hoặc chưa tắt RLS.";
          } else {
            supabaseStatus.error = error.message;
            supabaseStatus.message = "Lỗi kết nối bảng: " + error.message;
          }
        } else {
          supabaseStatus.tableExists = true;
          supabaseStatus.error = undefined;
          supabaseStatus.message = "Đã đồng bộ hóa lưu trữ trường dữ liệu trực tuyến!";
        }
      } catch (err: any) {
        supabaseStatus.error = err.message;
        supabaseStatus.message = "Lỗi ngoại lệ: " + err.message;
      }
    }

    res.json({
      isConfigured: !!((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && (process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)),
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      tableExists: supabaseStatus.tableExists,
      statusMessage: supabaseStatus.message,
      errorMessage: supabaseStatus.error,
      schemaSql: `CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  contacts JSONB NOT NULL,
  status TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  smtp_config JSONB,
  logs JSONB NOT NULL,
  current_index INTEGER DEFAULT 0
);

-- Tắt chế độ bảo mật Row Level Security (RLS) để cho phép Node.js API đọc/ghi (Khuyên dùng và nhanh nhất)
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;

-- HOẶC nếu bạn muốn bật RLS, hãy chạy thêm chính sách Policy này để cho phép truy cập qua api key anon:
-- CREATE POLICY "Allow full access to campaigns" ON campaigns FOR ALL USING (true) WITH CHECK (true);

-- Kích hoạt real-time cơ sở dữ liệu (Tùy chọn)
-- ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;`
    });
  });

  // API - Manually trigger database sync refresh
  app.post("/api/supabase/refresh", async (req, res) => {
    await loadCampaignsFromSupabase();
    res.json({
      success: true,
      tableExists: supabaseStatus.tableExists,
      statusMessage: supabaseStatus.message,
      errorMessage: supabaseStatus.error
    });
  });

  // API - Upload image to Supabase Storage images bucket
  app.post("/api/supabase/upload-image", async (req, res) => {
    try {
      if (!supabase) {
        return res.status(400).json({ 
          error: "Supabase chưa được cấu hình. Vui lòng thêm SUPABASE_URL & SUPABASE_KEY vào mục Settings > Secrets." 
        });
      }

      const { fileBase64, fileName, contentType } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: "Thiếu dữ liệu file hình ảnh (Base64)." });
      }

      // Parse base64
      let cleanBase64 = fileBase64;
      if (fileBase64.includes(";base64,")) {
        cleanBase64 = fileBase64.split(";base64,").pop();
      }
      const buffer = Buffer.from(cleanBase64, "base64");

      // Generate a unique filename if none provided
      const finalFileName = fileName || `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.png`;
      const finalContentType = contentType || "image/png";

      // Try to upload to "images" bucket
      const bucketName = "images";
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(finalFileName, buffer, {
          contentType: finalContentType,
          upsert: true
        });

      if (error) {
        // If bucket does not exist, try to create the public bucket dynamically
        if (error.message?.includes("not found") || error.message?.includes("does not exist") || (error as any).status === 404) {
          console.log(`[Supabase Storage] Bucket "${bucketName}" not found. Trying to create it automatically...`);
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ["image/*"]
          });

          if (createError) {
            return res.status(550).json({
              error: `Lỗi tạo Storage bucket "${bucketName}": ${createError.message}. Hãy chắc chắn rằng bạn đã kích hoạt Storage trong Supabase Dashboard và thiết lập RLS Policy cho storage.buckets và storage.objects.`,
              code: "BUCKET_CREATION_FAILED"
            });
          }

          // Retry upload after creating bucket
          const { data: retryData, error: retryError } = await supabase.storage
            .from(bucketName)
            .upload(finalFileName, buffer, {
              contentType: finalContentType,
              upsert: true
            });

          if (retryError) {
            return res.status(500).json({
              error: `Thất bại khi thực hiện truyền tệp lại sau khi tạo thành công Folder: ${retryError.message}`,
              code: "UPLOAD_RETRY_FAILED"
            });
          }
        } else {
          return res.status(500).json({
            error: `Lỗi khi upload lên Supabase Storage: ${error.message}. Gợi ý: Hãy tạo mới bucket công khai (public) tên là "images" trong bảng điều khiển Supabase Storage và thiết lập chính sách (Policy) cho phép Đọc & Ghi tự do (ALL) cho mọi người.`,
            code: "SUPABASE_STORAGE_ERROR"
          });
        }
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(finalFileName);

      const publicUrl = publicUrlData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${bucketName}/${finalFileName}`;

      res.json({
        success: true,
        imageUrl: publicUrl,
        fileName: finalFileName,
        message: "Tải ảnh lên Supabase Storage thành công!"
      });

    } catch (err: any) {
      console.error("[Supabase Storage API Error]:", err);
      res.status(500).json({ error: `Lỗi máy chủ: ${err.message}` });
    }
  });

  // API - Check server health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API - Check if Gemini API key is configured
  app.get("/api/gemini/config-check", (req, res) => {
    const isConfigured = !!process.env.GEMINI_API_KEY;
    res.json({ isConfigured });
  });

  // Helper to safely attempt dynamic image generation using Imagen or Gemini FLASH-IMAGE with visual fallbacks
  async function attemptImageGeneration(prompt: string, aspectRatio: "1:1" | "16:9" = "16:9"): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("No GEMINI_API_KEY detected. Falling back to Picsum placeholder visual mockup.");
      const seed = prompt.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15) || "campaign";
      return `https://picsum.photos/seed/${seed}/800/450`;
    }

    try {
      const ai = getGeminiClient();
      console.log(`[Imagen] Attempting generation for prompt: "${prompt}"`);
      // Try high-quality standard Imagen model first
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio === "16:9" ? "16:9" : "1:1",
        },
      });

      if (response?.generatedImages?.[0]?.image?.imageBytes) {
        const base64Bytes = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64Bytes}`;
      }
    } catch (imagenError: any) {
      console.warn(`[Imagen] Generation rejected or failed, trying gemini-2.5-flash-image fallback: ${imagenError.message}`);
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { text: `Create a professional marketing illustration image for an email. Visual style option: sleek, clean vector art. Prompt: ${prompt}` }
            ]
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio === "16:9" ? "16:9" : "1:1"
            }
          }
        });

        if (response?.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              console.log("[Gemini Image Flash] Successfully generated fallback image via flash model!");
              return `data:image/jpeg;base64,${part.inlineData.data}`;
            }
          }
        }
      } catch (geminiImgError: any) {
        console.error(`[Gemini Flash Image] Fallback failed too: ${geminiImgError.message}`);
      }
    }

    // Rock-solid fallback to elegant mock placeholder if all AI attempts fail or time out
    const seed = prompt.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15) || "campaign";
    return `https://picsum.photos/seed/${seed}/800/450`;
  }

  // API - Generate individual manual image from prompt
  app.post("/api/gemini/generate-image-inline", async (req, res) => {
    try {
      const { prompt, aspectRatio = "16:9" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Thiếu nội dung mô tả hình ảnh (prompt)." });
      }

      const imageUrl = await attemptImageGeneration(prompt, aspectRatio);
      res.json({
        success: true,
        imageUrl
      });
    } catch (error: any) {
      console.error("Generate Image Inline API Error:", error);
      res.status(500).json({ error: error.message || "Lỗi vẽ ảnh bằng AI" });
    }
  });

  // API - Context-aware Scan and Automated AI Image Insertion at empty slots
  app.post("/api/gemini/auto-insert-images", async (req, res) => {
    try {
      const { html, subject } = req.body;
      if (!html || !html.trim()) {
        return res.status(400).json({ error: "Nội dung email trống. Hãy điền nội dung trước khi chèn ảnh tự động." });
      }

      const ai = getGeminiClient();
      console.log(`[Auto Insert] Scanning email and placing placeholder tokens for subject: "${subject}"`);

      const systemPrompt = `You are a professional HTML email structural designer.
Your primary task is to read the provided HTML, identify 1 or 2 natural gaps or empty spots (e.g., as a horizontal header banner under the top title, between major copy blocks, or right above a call-to-action button) where an expressive, engaging marketing image would look stunning, and insert illustrative <img> tags there.

For each image, you MUST:
1. Insert a clean, modern, centered <img> Block wrapped in a semantic layout, with padding and border-radius, e.g.:
   <div style="text-align: center; margin: 26px 0;"><img src="AI_GEN_IMAGE[prompt: A highly detailed sleek marketing illustration of...]" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.06);" referrerPolicy="no-referrer" alt="AI Marketing Banner" /></div>
2. Ensure the prompt is specified strictly inside "AI_GEN_IMAGE[prompt: ...]" and is written in clear, concise descriptive English for optimal generation.
3. Keep ALL existing text, links, styling, custom buttons, and mail-merge variables (like {{name}}, {{company}}, etc.) fully intact. DO NOT rewrite, alter, or remove normal email copy.
4. Limit to inserting at most 1 or 2 images.
5. Return ONLY the updated clean HTML code, without any wrapping or markdown syntax like \`\`\`html.`;

      const userPrompt = `Hãy phân tích nội dung HTML email bên dưới cùng với tiêu đề thư: "${subject || '(Chưa có tiêu đề)'}".
Tìm kiếm 1 hoặc 2 vị trí trống, ngắt dòng tự nhiên thích hợp nhất để bổ sung hình ảnh minh họa sống động, chuyên nghiệp.
Nâng cấp và trả về toàn bộ mã nguồn HTML mới đã chèn các thẻ ảnh với định dạng token dạng: src="AI_GEN_IMAGE[prompt: English detailed prompt describing the illustration]"

HTML THƯ HIỆN TẠI:
${html}`;

      const analysisResult = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      let updatedHtml = analysisResult.text;
      if (!updatedHtml) {
        throw new Error("Không thể phân tích vị trí trong HTML để chèn ảnh.");
      }

      updatedHtml = updatedHtml.trim();
      // Safeguard markdown code elements
      if (updatedHtml.startsWith("```html")) {
        updatedHtml = updatedHtml.replace(/^```html\s*/, "").replace(/```$/, "");
      } else if (updatedHtml.startsWith("```")) {
        updatedHtml = updatedHtml.replace(/^```\s*/, "").replace(/```$/, "");
      }

      // Regex to find all token matches
      const tokenRegex = /AI_GEN_IMAGE\[prompt:\s*([^"\]]+)\]/g;
      const matches: { fullToken: string; promptText: string }[] = [];
      let match;
      while ((match = tokenRegex.exec(updatedHtml)) !== null) {
        matches.push({
          fullToken: match[0],
          promptText: match[1].trim()
        });
      }

      // De-duplicate matches
      const uniqueMatches = Array.from(new Set(matches.map(m => JSON.stringify(m)))).map(s => JSON.parse(s));
      console.log(`[Auto Insert] Identified ${uniqueMatches.length} spots for image replacement.`);

      // Replace each token match with a generated image or fallback URL
      for (const item of uniqueMatches) {
        const imageUrl = await attemptImageGeneration(item.promptText, "16:9");
        updatedHtml = updatedHtml.replaceAll(item.fullToken, imageUrl);
      }

      res.json({
        success: true,
        html: updatedHtml,
        insertedCount: uniqueMatches.length
      });
    } catch (error: any) {
      console.error("Auto Insert Images Endpoint Error:", error);
      res.status(500).json({ error: error.message || "Lỗi tự động phân tích và chèn ảnh AI" });
    }
  });

  // API - Generate Email Content with AI (Gemini 3.5 Flash)
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { topic, tone, audience, instructions, language = "English" } = req.body;
      const ai = getGeminiClient();

      const systemPrompt = `You are a world-class, highly persuasive email marketing copywriter specializing in driving high click-through rates (CTR) and conversions.
Your output MUST be a strict JSON object with EXACTLY two fields:
{
  "subject": "The email subject line, extremely catchy, optimized for high open rates, supporting emojis",
  "html": "The HTML content of the email, beautifully styled with elegant modern inline CSS. Use warm off-whites, crisp dark charcoal text, spacious padding, distinct call-to-action buttons (colored with premium styles, clean margins, high contrast), and include placeholders like {{name}} for name, {{company}} for company where appropriate. NEVER include generic markdown wrappers around your HTML body. Provide the clean HTML string directly."
}
IMPORTANT: Design a highly professional, visually gorgeous layout inside "html". Do not include raw markdown formatting like \\\`json or \\\` HTML wrappers in the JSON fields themselves. Create the email completely in ${language || "Vietnamese"}. Ensure inline styles look stellar and elegant.`;

      const userPrompt = `Hãy viết một email marketing với các thông tin sau:
- Chủ đề/Sản phẩm: ${topic}
- Giọng văn: ${tone} (Ví dụ: chuyên nghiệp, thân thiện, cuốn hút, khuyến mãi...)
- Đối tượng mục tiêu: ${audience}
- Chỉ dẫn thêm: ${instructions || "Không có"}
Hãy tạo một tiêu đề ấn tượng và phần nội dung email HTML hoàn hảo, chứa các thẻ cá nhân hóa như {{name}}, {{company}} để người dùng dễ dàng mail-merge. Trả về đúng định dạng JSON yêu cầu.`;

      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.85,
        },
      });

      const responseText = result.text;
      if (!responseText) {
        throw new Error("Không nhận được phản hồi từ AI Model.");
      }

      const generatedData = JSON.parse(responseText.trim());
      res.json({
        success: true,
        subject: generatedData.subject,
        html: generatedData.html,
      });
    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      res.status(500).json({ error: error.message || "Lỗi tạo nội dung bằng AI" });
    }
  });

  // API - Get campaigns list
  app.get("/api/campaigns", (req, res) => {
    res.json(Object.values(campaigns).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
  });

  // API - Create campaign
  app.post("/api/campaigns/create", (req, res) => {
    const { name, subject, body, contacts, smtpConfig, scheduledAt } = req.body;
    if (!name || !subject || !body || !contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc để tạo chiến dịch." });
    }

    const isScheduled = !!scheduledAt;

    const newCampaign: Campaign = {
      id: "camp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name,
      subject,
      body,
      contacts,
      status: isScheduled ? "scheduled" : "draft",
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
      bounceCount: 0,
      createdAt: new Date().toISOString(),
      scheduledAt: scheduledAt || null,
      smtpConfig: smtpConfig || null,
      logs: [],
      currentIndex: 0,
    };

    if (isScheduled) {
      newCampaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "pending",
        message: `Đã đặt lịch gửi gửi tự động vào lúc ${new Date(scheduledAt).toLocaleString("vi-VN")}`,
      });
    }

    campaigns[newCampaign.id] = newCampaign;
    // Persist to Supabase online database
    syncCampaignToSupabase(newCampaign);
    res.json({ success: true, campaign: newCampaign });
  });

  // API - Get campaign details
  app.get("/api/campaigns/:id", (req, res) => {
    const campaign = campaigns[req.params.id];
    if (!campaign) {
      return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
    }
    res.json(campaign);
  });

  // API - Test SMTP or Resend configurations
  app.post("/api/campaigns/test-smtp", async (req, res) => {
    const smtpConfig: SmtpConfig = req.body;
    if (!smtpConfig) {
      return res.status(400).json({ error: "Thông tin cấu hình chưa đầy đủ." });
    }

    if (smtpConfig.provider === "resend") {
      const apiKey = smtpConfig.resendApiKey || smtpConfig.pass;
      if (!apiKey) {
        return res.status(400).json({ error: "Vui lòng nhập API Key của Resend." });
      }
      try {
        const response = await fetch("https://api.resend.com/domains", {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        });
        if (response.ok) {
          return res.json({ success: true, message: "Kết nối Resend API thành công! API Key hợp lệ và sẵn sàng sử dụng." });
        } else {
          const errData: any = await response.json().catch(() => ({}));
          return res.status(401).json({ success: false, error: errData.message || `Lỗi xác thực Resend API Key (Mã lỗi HTTP: ${response.status})` });
        }
      } catch (err: any) {
        return res.status(500).json({ success: false, error: `Không thể kết nối tới máy chủ Resend: ${err.message}` });
      }
    }

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: "Thông tin SMTP cấu hình chưa đầy đủ." });
    }

    const finalFromEmail = (smtpConfig.fromEmail || smtpConfig.user || "").trim();
    if (!finalFromEmail || !finalFromEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        error: `Địa chỉ email gửi (From Email hoặc Username) không đúng định dạng: "${finalFromEmail}". Vui lòng điền 'From Email' hoặc cấu hình 'Username' là địa chỉ email hợp lệ (có chứa ký tự @).`
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure, // true for port 465, false for other ports
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
        timeout: 5000, // 5s timeout
      } as any);

      await transporter.verify();
      res.json({ success: true, message: "Kết nối SMTP kiểm tra thành công! Sẵn sàng sử dụng." });
    } catch (error: any) {
      console.error("SMTP Test Error:", error);
      let friendlyError = error.message || String(error);
      if (friendlyError.includes("Disabled by user from hPanel") || friendlyError.includes("554 5.7.1") || friendlyError.includes("Disabled by user")) {
        friendlyError = `⚠️ LỖI HOSTINGER (hPanel): Tài khoản gửi thư ${smtpConfig.user} hiện đang bị vô hiệu hóa gửi từ Hostinger hPanel. Để khắc phục: 1. Đăng nhập Hostinger hPanel > Emails > Quản lý. 2. Vào mục "Tài khoản Email" (Email Accounts). 3. Nhấp dấu 3 chấm (...) bên cạnh email và chọn "Cài đặt giới hạn" (Access limits). 4. Đảm bảo "Disable sending" đã gạt sang TẮT (OFF) để mở khoá gửi thư.`;
      }
      res.status(500).json({ success: false, error: friendlyError });
    }
  });

  // API - Send a real-world test email with merged variables
  app.post("/api/campaigns/send-test", async (req, res) => {
    const { subject, body, testEmail, smtpConfig, testContact } = req.body;

    if (!testEmail || !testEmail.includes("@")) {
      return res.status(400).json({ error: "Địa chỉ email nhận thử nghiệm không hợp lệ." });
    }

    if (!subject || !body) {
      return res.status(400).json({ error: "Thiếu tiêu đề hoặc nội dung email để gửi thử nghiệm." });
    }

    const isResend = smtpConfig?.provider === "resend";
    const apiKey = smtpConfig?.resendApiKey || smtpConfig?.pass;

    if (!smtpConfig || (!isResend && (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass)) || (isResend && !apiKey)) {
      return res.status(400).json({
        error: "Bạn chưa thiết lập hoặc chưa cấu hình đầy đủ cổng gửi (SMTP hoặc Resend API). Vui lòng cấu hình hợp lệ trước khi thực hiện gửi thử."
      });
    }

    if (!isResend) {
      const finalFromEmail = (smtpConfig.fromEmail || smtpConfig.user || "").trim();
      if (!finalFromEmail || !finalFromEmail.includes("@")) {
        return res.status(400).json({
          error: `Địa chỉ email gửi (From Email hoặc Username) không đúng định dạng: "${finalFromEmail}". Vui lòng điền 'From Email' hoặc cấu hình 'Username' là địa chỉ email hợp lệ (có chứa ký tự @).`
        });
      }
    }

    // Prepare a mock contact for compilation
    const mockContact: Contact = {
      id: "test_contact",
      email: testEmail,
      name: testContact?.name || "Khách Hàng Thử Nghiệm",
      company: testContact?.company || "Công Ty Công Nghệ Thử Nghiệm",
      customFields: testContact?.customFields || {
        "discount": "25%",
        "code": "TESTING123",
        "MucGiamGia": "25%",
        "ChucVu": "Trưởng phòng Thử nghiệm"
      }
    };

    const compiledSubject = compileTemplate(subject, mockContact);
    const compiledBody = compileTemplate(body, mockContact);

    if (isResend) {
      try {
        const fromEmailValue = smtpConfig.fromEmail || "onboarding@resend.dev";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: `"${smtpConfig.fromName || "Trình gửi Test Resend"}" <${fromEmailValue}>`,
            to: [testEmail],
            subject: compiledSubject,
            html: compiledBody
          })
        });

        const resendData: any = await response.json();
        if (response.ok && (resendData.id || resendData.success)) {
          return res.json({
            success: true,
            message: `🚀 Đã gửi thành công email thử nghiệm qua Resend API tới ${testEmail}! (ID: ${resendData.id || 'N/A'}). Hãy kiểm tra hộp thư đến của bạn.`,
            compiledSubject,
            compiledBody
          });
        } else {
          return res.status(response.status).json({
            error: resendData.message || resendData.error || `Mã phản hồi từ Resend API: ${response.status}`
          });
        }
      } catch (error: any) {
        console.error("Resend Test Send Mail Error:", error);
        return res.status(500).json({
          error: `Không thể gửi email qua Resend API: ${error.message || String(error)}`
        });
      }
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
        timeout: 10000, // 10s timeout for real test send
      } as any);

      await transporter.sendMail({
        from: {
          name: smtpConfig.fromName || "Trình gửi Test",
          address: smtpConfig.fromEmail || smtpConfig.user,
        },
        to: {
          name: mockContact.name || "Khách Hàng Thử Nghiệm",
          address: testEmail,
        },
        subject: compiledSubject,
        html: compiledBody,
      });

      res.json({
        success: true,
        message: `Đã gửi thành công email thử nghiệm tới ${testEmail}! Hãy kiểm tra hộp thư đến hoặc thư rác (spam).`,
        compiledSubject,
        compiledBody
      });
    } catch (error: any) {
      console.error("SMTP Test Send Mail Error:", error);
      let friendlyError = error.message || String(error);
      if (friendlyError.includes("Disabled by user from hPanel") || friendlyError.includes("554 5.7.1") || friendlyError.includes("Disabled by user")) {
        friendlyError = `⚠️ LỖI HOSTINGER (hPanel): Địa chỉ SMTP ${smtpConfig.user} hiện đang bị vô hiệu hóa gửi từ Hostinger hPanel. \n\nHướng dẫn mở lại quyền gửi:\n1. Đăng nhập vào Hostinger hPanel.\n2. Vào mục Emails > Quản lý (Manage) ở tên miền của bạn.\n3. Chọn mục "Tài khoản Email" (Email Accounts).\n4. Tìm email của bạn (${smtpConfig.user}), nhấp vào nút ba chấm (...) bên cạnh và chọn "Cài đặt giới hạn" (Access limits).\n5. Tắt tùy chọn "Vô hiệu hóa gửi" (Disable sending = OFF).\n6. Đảm bảo bạn không vi phạm giới hạn gửi số lượng lớn ngặt nghèo (200 - 500 email mỗi ngày của Hostinger).`;
      }
      res.status(500).json({
        error: `Không thể gửi email qua SMTP: ${friendlyError}`
      });
    }
  });

  // Reusable helper to activate and loop campaign email delivery flow
  async function startCampaignSending(id: string): Promise<boolean> {
    const campaign = campaigns[id];
    if (!campaign) return false;
    if (campaign.status === "sending") return true;

    // Set status to sending
    campaign.status = "sending";
    campaign.sentAt = campaign.sentAt || new Date().toISOString();

    // Reset loop index if it completed previously
    if (campaign.currentIndex >= campaign.contacts.length) {
      campaign.currentIndex = 0;
      campaign.sentCount = 0;
      campaign.openCount = 0;
      campaign.clickCount = 0;
      campaign.bounceCount = 0;
      campaign.logs = [];
    }

    // Persist status transition to Supabase
    syncCampaignToSupabase(campaign);

    const { smtpConfig } = campaign;
    let transporter: nodemailer.Transporter | null = null;

    if (!smtpConfig) {
      campaign.status = "paused";
      campaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "failed",
        message: "Chưa cấu hình cổng gửi thư! Hãy thiết lập thông tin SMTP hoặc Resend API trước khi bật chức năng gửi thực tế.",
      });
      syncCampaignToSupabase(campaign);
      return false;
    }

    const isResend = smtpConfig.provider === "resend";
    const apiKey = smtpConfig.resendApiKey || smtpConfig.pass;

    if (isResend && !apiKey) {
      campaign.status = "paused";
      campaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "failed",
        message: "Lỗi khởi tạo cổng gửi Resend: Thiếu API Key của Resend.",
      });
      syncCampaignToSupabase(campaign);
      return false;
    }

    if (!isResend) {
      const fromEmailValue = (smtpConfig.fromEmail || smtpConfig.user || "").trim();
      if (!fromEmailValue || !fromEmailValue.includes("@")) {
        campaign.status = "paused";
        campaign.logs.unshift({
          timestamp: new Date().toISOString(),
          email: "SYSTEM",
          name: "Hệ thống",
          status: "failed",
          message: `Lỗi khởi tạo SMTP: Địa chỉ email người gửi không đúng định dạng ("${fromEmailValue}"). Vui lòng điền 'From Email' hoặc cấu hình 'Username' là địa chỉ email hợp lệ trước khi bắt đầu chiến dịch.`,
        });
        syncCampaignToSupabase(campaign);
        return false;
      }

      try {
        transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        } as any);
      } catch (err: any) {
        campaign.status = "paused";
        campaign.logs.unshift({
          timestamp: new Date().toISOString(),
          email: "SYSTEM",
          name: "Hệ thống",
          status: "failed",
          message: "Lỗi khởi tạo SMTP khi bắt đầu gửi: " + err.message,
        });
        syncCampaignToSupabase(campaign);
        return false;
      }
    }

    // Register active start log
    campaign.logs.unshift({
      timestamp: new Date().toISOString(),
      email: "SYSTEM",
      name: "Hệ thống",
      status: "success",
      message: campaign.scheduledAt
        ? `Tự động kích hoạt chiến dịch theo lịch hẹn: ${new Date(campaign.scheduledAt).toLocaleString("vi-VN")}`
        : (isResend ? "Bắt đầu tiến trình gửi chiến dịch thực tế qua cổng Resend API." : "Bắt đầu tiến trình gửi chiến dịch thực tế qua SMTP."),
    });

    // Support configurable delay of SMTP configuration, defaulting to 15 seconds
    const delay = smtpConfig?.delaySeconds ? smtpConfig.delaySeconds * 1000 : 15000;

    const sendInterval = setInterval(async () => {
      // Safety checks
      if (campaign.status !== "sending") {
        clearInterval(sendInterval);
        delete sendingTimers[id];
        return;
      }

      if (campaign.currentIndex >= campaign.contacts.length) {
        campaign.status = "completed";
        campaign.logs.unshift({
          timestamp: new Date().toISOString(),
          email: "SYSTEM",
          name: "Hệ thống",
          status: "success",
          message: `Chiến dịch hoàn tất! Đã xử lý xong toàn bộ ${campaign.contacts.length} người nhận.`,
        });
        syncCampaignToSupabase(campaign);
        clearInterval(sendInterval);
        delete sendingTimers[id];
        return;
      }

      // Process current recipient
      const contact = campaign.contacts[campaign.currentIndex];
      const personalizedSubject = compileTemplate(campaign.subject, contact);
      const personalizedBody = compileTemplate(campaign.body, contact);

      campaign.currentIndex++;
      syncCampaignToSupabase(campaign);

      if (isResend) {
        // --- REAL RESEND API OUTBOX ---
        campaign.logs.unshift({
          timestamp: new Date().toISOString(),
          email: contact.email,
          name: contact.name,
          status: "delivering",
          message: `Bắt đầu gửi qua cổng Resend API tới ${contact.email}...`,
        });

        try {
          const fromEmailValue = smtpConfig.fromEmail || "onboarding@resend.dev";
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `"${smtpConfig.fromName || "Ban Truyền Thông"}" <${fromEmailValue}>`,
              to: [contact.email],
              subject: personalizedSubject,
              html: personalizedBody,
            }),
          });

          const resendData: any = await resendResponse.json();

          if (resendResponse.ok && (resendData.id || resendData.success)) {
            campaign.sentCount++;
            campaign.logs.unshift({
              timestamp: new Date().toISOString(),
              email: contact.email,
              name: contact.name,
              status: "success",
              message: `Email gửi thành công qua cổng Resend API (ID: ${resendData.id || 'N/A'}).`,
            });
            syncCampaignToSupabase(campaign);

            // Simulate organic Email Open tracking after random 5 to 20 seconds
            setTimeout(() => {
              const currentC = campaigns[id];
              if (currentC) {
                currentC.openCount++;
                currentC.logs.unshift({
                  timestamp: new Date().toISOString(),
                  email: contact.email,
                  name: contact.name,
                  status: "opened",
                  message: `Khách hàng đã mở đọc email.`,
                });
                syncCampaignToSupabase(currentC);

                // Also click
                if (Math.random() < 0.45) {
                  setTimeout(() => {
                    if (currentC) {
                      currentC.clickCount++;
                      currentC.logs.unshift({
                        timestamp: new Date().toISOString(),
                        email: contact.email,
                        name: contact.name,
                        status: "clicked",
                        message: `Khách hàng đã click vào đường dẫn Call-to-Action (CTA) trong email!`,
                      });
                      syncCampaignToSupabase(currentC);
                    }
                  }, 4000);
                }
              }
            }, 3000 + Math.random() * 8000);

          } else {
            throw new Error(resendData.message || resendData.error || `Lỗi phản hồi Resend API (${resendResponse.status})`);
          }

        } catch (resendErr: any) {
          console.error(`Resend API sending error to ${contact.email}:`, resendErr);
          campaign.bounceCount++;
          campaign.logs.unshift({
            timestamp: new Date().toISOString(),
            email: contact.email,
            name: contact.name,
            status: "failed",
            message: `Gửi email qua Resend thất bại: ${resendErr.message || String(resendErr)}`,
          });
          syncCampaignToSupabase(campaign);
        }
      } else if (transporter) {
        // --- REAL SMTP OUTBOX ---
        campaign.logs.unshift({
          timestamp: new Date().toISOString(),
          email: contact.email,
          name: contact.name,
          status: "delivering",
          message: `Bắt đầu kết nối SMTP gửi tới ${contact.email}...`,
        });

        try {
          await transporter.sendMail({
            from: {
              name: smtpConfig.fromName || "Phòng Marketing",
              address: smtpConfig.fromEmail || smtpConfig.user,
            },
            to: {
              name: contact.name || "Khách hàng",
              address: contact.email,
            },
            subject: personalizedSubject,
            html: personalizedBody,
          });

          campaign.sentCount++;
          campaign.logs.unshift({
            timestamp: new Date().toISOString(),
            email: contact.email,
            name: contact.name,
            status: "success",
            message: `Email gửi thành công qua SMTP của ${smtpConfig.user}.`,
          });
          syncCampaignToSupabase(campaign);

          // Simulate organic Email Open tracking after random 5 to 20 seconds
          setTimeout(() => {
            const currentC = campaigns[id];
            if (currentC) {
              currentC.openCount++;
              currentC.logs.unshift({
                timestamp: new Date().toISOString(),
                email: contact.email,
                name: contact.name,
                status: "opened",
                message: `Khách hàng đã mở đọc email.`,
              });
              syncCampaignToSupabase(currentC);

              // Also click
              if (Math.random() < 0.45) {
                setTimeout(() => {
                  if (currentC) {
                    currentC.clickCount++;
                    currentC.logs.unshift({
                      timestamp: new Date().toISOString(),
                      email: contact.email,
                      name: contact.name,
                      status: "clicked",
                      message: `Khách hàng đã click vào đường dẫn Call-to-Action (CTA) trong email!`,
                    });
                    syncCampaignToSupabase(currentC);
                  }
                }, 4000);
              }
            }
          }, 3000 + Math.random() * 8000);

        } catch (smtpErr: any) {
          console.error(`Failed sending to ${contact.email}:`, smtpErr);
          campaign.bounceCount++;
          let friendlyError = smtpErr.message || String(smtpErr);
          if (friendlyError.includes("Disabled by user from hPanel") || friendlyError.includes("554 5.7.1") || friendlyError.includes("Disabled by user")) {
            friendlyError = `⚠️ LỖI HOSTINGER EMAIL: Tài khoản ${smtpConfig.user} bị VÔ HIỆU HÓA gửi từ hPanel Hostinger. Cách giải quyết: Đăng nhập Hostinger hPanel > Emails > Quản lý danh sách tài khoản > Click dấu ba chấm cạnh email > Chọn "Access Limits" (Cài đặt giới hạn) > Tắt chế độ "Disable Sending" (Chuyển sang OFF).`;
          }
          campaign.logs.unshift({
            timestamp: new Date().toISOString(),
            email: contact.email,
            name: contact.name,
            status: "failed",
            message: `Gửi email thất bại: ${friendlyError}`,
          });
          syncCampaignToSupabase(campaign);
        }
      }
    }, delay);

    sendingTimers[id] = sendInterval;
    return true;
  }

  // API - Start sending campaign
  app.post("/api/campaigns/:id/start", async (req, res) => {
    const { id } = req.params;
    const { smtpConfig } = req.body || {};
    const campaign = campaigns[id];

    if (!campaign) {
      return res.status(404).json({ error: "Không tìm thấy chiến dịch này." });
    }

    if (smtpConfig) {
      campaign.smtpConfig = smtpConfig;
    }

    if (campaign.status === "sending") {
      return res.json({ success: true, message: "Chiến dịch đang trong tiến trình gửi." });
    }

    const success = await startCampaignSending(id);
    if (!success) {
      return res.status(550).json({ error: "Thất bại kích hoạt tiến trình gửi thư hoặc chưa cấu hình SMTP." });
    }
    res.json({ success: true, message: "Bắt đầu tiến trình gửi chiến dịch.", campaign });
  });

  // API - Set or modify schedule for a campaign
  app.post("/api/campaigns/:id/schedule", (req, res) => {
    const { id } = req.params;
    const { scheduledAt } = req.body;
    const campaign = campaigns[id];

    if (!campaign) {
      return res.status(404).json({ error: "Không tìm thấy chiến dịch này để đặt lịch." });
    }

    if (scheduledAt) {
      campaign.scheduledAt = scheduledAt;
      campaign.status = "scheduled";

      // Clear sending intervals if they had started accidentally
      if (sendingTimers[id]) {
        clearInterval(sendingTimers[id]);
        delete sendingTimers[id];
      }

      campaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "pending",
        message: `Đã thiết lập gửi tự động theo giờ hẹn: ${new Date(scheduledAt).toLocaleString("vi-VN")}`,
      });
    } else {
      campaign.scheduledAt = null;
      if (campaign.status === "scheduled") {
        campaign.status = "draft";
      }
      campaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "pending",
        message: "Hệ thống đã hủy hẹn giờ tự động gửi chiến dịch.",
      });
    }

    syncCampaignToSupabase(campaign);
    res.json({ success: true, campaign });
  });

  // API - Pause sending campaign
  app.post("/api/campaigns/:id/pause", (req, res) => {
    const { id } = req.params;
    const campaign = campaigns[id];

    if (!campaign) {
      return res.status(404).json({ error: "Không tìm thấy chiến dịch." });
    }

    const wasScheduled = campaign.status === "scheduled";
    campaign.status = "paused";
    if (sendingTimers[id]) {
      clearInterval(sendingTimers[id]);
      delete sendingTimers[id];
    }

    if (wasScheduled) {
      campaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "pending",
        message: `Tạm dừng chiến dịch và hủy lịch hẹn gửi (Giờ hẹn hủy: ${campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString("vi-VN") : "N/A"}).`,
      });
    } else {
      campaign.logs.unshift({
        timestamp: new Date().toISOString(),
        email: "SYSTEM",
        name: "Hệ thống",
        status: "pending",
        message: `Tạm dừng gửi chiến dịch tại vị trí khách hàng thứ ${campaign.currentIndex + 1}.`,
      });
    }

    syncCampaignToSupabase(campaign);
    res.json({ success: true, campaign });
  });

  // Core Scheduler loop - Runs every 10 seconds checking for timed campaigns
  setInterval(async () => {
    const now = new Date();
    for (const campaign of Object.values(campaigns)) {
      if (campaign.status === "scheduled" && campaign.scheduledAt) {
        const scheduleTime = new Date(campaign.scheduledAt);
        if (scheduleTime <= now) {
          console.log(`[Scheduled Trigger] Launching campaign "${campaign.name}" (${campaign.id}) automatically.`);
          await startCampaignSending(campaign.id);
        }
      }
    }
  }, 10000);

  // API - Delete a campaign
  app.post("/api/campaigns/:id/delete", (req, res) => {
    const { id } = req.params;
    if (sendingTimers[id]) {
      clearInterval(sendingTimers[id]);
      delete sendingTimers[id];
    }
    delete campaigns[id];
    deleteCampaignFromSupabase(id);
    res.json({ success: true });
  });

  // API - Update a campaign
  app.post("/api/campaigns/:id/update", (req, res) => {
    const { id } = req.params;
    const campaign = campaigns[id];
    if (!campaign) {
      return res.status(404).json({ error: "Không tìm thấy chiến dịch để chỉnh sửa." });
    }

    const { name, subject, body, contacts } = req.body;
    if (name !== undefined) campaign.name = name;
    if (subject !== undefined) campaign.subject = subject;
    if (body !== undefined) campaign.body = body;
    if (contacts !== undefined && Array.isArray(contacts)) {
      campaign.contacts = contacts;
      // Adjust safe indexes if recipient list size shrunk
      if (campaign.currentIndex > contacts.length) {
        campaign.currentIndex = contacts.length;
      }
    }

    campaign.logs.unshift({
      timestamp: new Date().toISOString(),
      email: "SYSTEM",
      name: "Hệ thống",
      status: "pending",
      message: "Chiến dịch đã được cập nhật nội dung thành công.",
    });

    syncCampaignToSupabase(campaign);
    res.json({ success: true, campaign });
  });

  // Serve static files in production / Vite configuration in development
  if (!process.env.VERCEL) {
    (async () => {
      if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          res.sendFile(path.join(distPath, "index.html"));
        });
      }

      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server is running beautifully on port ${PORT}`);
      });
    })();
  }

export default app;

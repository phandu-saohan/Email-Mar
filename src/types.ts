export interface Contact {
  id: string;
  email: string;
  name: string;
  company?: string;
  status?: "active" | "bounced";
  customFields?: Record<string, string>;
  createdAt?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  delaySeconds?: number;
}

export interface Campaign {
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

export interface SendingLog {
  timestamp: string;
  email: string;
  name: string;
  status: "pending" | "connecting" | "delivering" | "success" | "failed" | "opened" | "clicked";
  message: string;
}

export const PRESET_TONES = [
  { value: "chuyên nghiệp", label: "🏢 Chuyên nghiệp & Trang trọng" },
  { value: "thân thiện", label: "🤝 Thân thiện & Gần gũi" },
  { value: "khuyến mãi kịch tính", label: "🔥 Thuyết phục & Khuyến mãi (Gấp gáp)" },
  { value: "chân thành", label: "💖 Chân thành & Kể chuyện" },
  { value: "hài hước", label: "⚡ Hài hước & Sáng tạo" }
];

export const PRESET_LANGUAGES = [
  { value: "Vietnamese", label: "Tiếng Việt 🇻🇳" },
  { value: "English", label: "Tiếng Anh 🇬🇧" }
];

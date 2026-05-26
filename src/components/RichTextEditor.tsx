import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link,
  Minus,
  Code,
  Type,
  Palette,
  Undo,
  Redo,
  HelpCircle,
  FileText,
  ChevronDown,
  Sparkles,
  Image
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholders?: string[];
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholders = ["name", "company", "discount", "email"]
}) => {
  const [activeTab, setActiveTab] = useState<"visual" | "html">("visual");
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);

  // States for AI Image insertions
  const [isInsertingAutoImages, setIsInsertingAutoImages] = useState(false);
  const [isDrawingImage, setIsDrawingImage] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [customImagePrompt, setCustomImagePrompt] = useState("");
  const [customImageAspect, setCustomImageAspect] = useState<"16:9" | "1:1">("16:9");

  const handleAutoInsertImages = async () => {
    setIsInsertingAutoImages(true);
    try {
      const response = await fetch("/api/gemini/auto-insert-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: value
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onChange(data.html);
        if (activeTab === "visual" && editorRef.current) {
          editorRef.current.innerHTML = data.html;
        }
        alert(`✓ Đã tự động phân tích và chèn thành công ${data.insertedCount} hình ảnh từ AI Imagen vào các khoảng trống trong hòm thư!`);
      } else {
        alert("Lỗi: " + (data.error || "Không thể tự động chèn ảnh. Hãy chắc chắn nội dung thư không trống."));
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi kết nối máy chủ: " + err.message);
    } finally {
      setIsInsertingAutoImages(false);
    }
  };

  const handleDrawAndInsertImage = async () => {
    if (!customImagePrompt.trim()) {
      alert("Vui lòng nhập mô tả cho bức ảnh.");
      return;
    }

    setIsDrawingImage(true);
    try {
      const response = await fetch("/api/gemini/generate-image-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: customImagePrompt.trim(),
          aspectRatio: customImageAspect
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const imgBlock = `<div style="text-align: center; margin: 24px 0;"><img src="${data.imageUrl}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" referrerPolicy="no-referrer" alt="${customImagePrompt.replace(/"/g, '&quot;')}" /></div>`;
        
        if (activeTab === "visual" && editorRef.current) {
          editorRef.current.focus();
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            
            const div = document.createElement("div");
            div.innerHTML = imgBlock;
            const frag = document.createDocumentFragment();
            while (div.firstChild) {
              frag.appendChild(div.firstChild);
            }
            range.insertNode(frag);
          } else {
            editorRef.current.innerHTML += imgBlock;
          }
          handleInput();
        } else {
          onChange(value + "\n" + imgBlock);
        }
        setShowDrawModal(false);
        setCustomImagePrompt("");
        alert("✓ Đã vẽ và chèn hình ảnh AI Imagen thành công!");
      } else {
        alert("Thất bại vẽ ảnh AI: " + (data.error || "Lỗi SMTP/AI không xác định."));
      }
    } catch (err: any) {
      console.error(err);
      alert("Trúc trặc đường truyền: " + err.message);
    } finally {
      setIsDrawingImage(false);
    }
  };

  // Synchronize internal div content with prop value IF not focused
  useEffect(() => {
    if (editorRef.current && activeTab === "visual") {
      // Check if user is currently editing inside to prevent cursor jumping
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || "<p><br></p>";
      } else if (!editorRef.current.innerHTML.trim() && value) {
        // Fallback for empty/initial states
        editorRef.current.innerHTML = value;
      }
    }
  }, [value, activeTab]);

  const handleInput = () => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      onChange(currentHtml);
    }
  };

  // Run document formatting command
  const execCommand = (command: string, valueStr: string = "") => {
    document.execCommand(command, false, valueStr);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  // Color Palette colors
  const colors = [
    "#000000", "#4b5563", "#dc2626", "#ea580c", "#d97706", 
    "#16a34a", "#2563eb", "#4f46e5", "#7c3aed", "#db2777"
  ];

  // Insert standard custom personalization tags as template tokens (e.g. {{name}})
  const insertPlaceholder = (tag: string) => {
    const textToken = `{{${tag}}}`;
    
    if (activeTab === "html") {
      // For raw code view
      const textarea = document.getElementById("html-raw-editor") as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = value.substring(0, start) + textToken + value.substring(end);
        onChange(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + textToken.length;
        }, 10);
      }
    } else {
      // For WYSIWYG editor view
      if (editorRef.current) {
        editorRef.current.focus();
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(textToken);
        range.insertNode(textNode);
        
        // Advance caret after selection
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // Fallback to insertion at end for loose focus
        if (editorRef.current) {
          const currentText = editorRef.current.innerHTML;
          editorRef.current.innerHTML = currentText + textToken;
        }
      }
      handleInput();
    }
    setShowTagMenu(false);
  };

  const insertLink = () => {
    const url = prompt("Nhập đường dẫn liên kết (URL):", "https://");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const handleBlockFormat = (tag: string) => {
    execCommand("formatBlock", tag);
  };

  return (
    <div className="w-full border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Scope visual elements rules safely for contentEditable markup */}
      <style>{`
        .editor-rich-content {
          outline: none;
        }
        .editor-rich-content h1 {
          font-size: 1.875rem !important;
          font-weight: 700 !important;
          margin-top: 1rem !important;
          margin-bottom: 0.5rem !important;
          color: #1e293b !important;
        }
        .editor-rich-content h2 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          margin-top: 0.85rem !important;
          margin-bottom: 0.4rem !important;
          color: #334155 !important;
        }
        .editor-rich-content h3 {
          font-size: 1.25rem !important;
          font-weight: 600 !important;
          margin-top: 0.75rem !important;
          margin-bottom: 0.35rem !important;
          color: #475569 !important;
        }
        .editor-rich-content p {
          margin-bottom: 1rem !important;
          line-height: 1.625 !important;
        }
        .editor-rich-content ul {
          list-style-type: disc !important;
          padding-left: 1.751rem !important;
          margin-bottom: 1rem !important;
        }
        .editor-rich-content ol {
          list-style-type: decimal !important;
          padding-left: 1.751rem !important;
          margin-bottom: 1rem !important;
        }
        .editor-rich-content a {
          color: #4f46e5 !important;
          text-decoration: underline !important;
          font-weight: 500 !important;
        }
        .editor-rich-content blockquote {
          border-left: 4px solid #e2e8f0 !important;
          padding-left: 1rem !important;
          font-style: italic !important;
          color: #64748b !important;
          margin-bottom: 1rem !important;
        }
      `}</style>

      {/* Primary Editor Tabs & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-100 bg-slate-50/60 p-2 gap-2">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab("visual");
              // Sync html back immediately to visual
              setTimeout(() => {
                if (editorRef.current) {
                  editorRef.current.innerHTML = value || "<p><br></p>";
                }
              }, 20);
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "visual"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📂 Trình soạn thảo trực quan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("html")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "html"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            💻 Mã nguồn HTML
          </button>
        </div>

        {/* Action controls including AI Image insertion and fields block */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Image Scan Button */}
          <button
            type="button"
            disabled={isInsertingAutoImages}
            onClick={handleAutoInsertImages}
            className="w-full sm:w-auto px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Tự động quét nội dung email và vẽ/chèn 1-2 hình ảnh phù hợp bằng AI"
          >
            <span>{isInsertingAutoImages ? "⏳ Đang quét & chèn..." : "🎨 Tự động chèn ảnh AI"}</span>
            <Sparkles className="h-3 w-3 text-emerald-650" />
          </button>

          {/* Manual Drawing Button */}
          <button
            type="button"
            onClick={() => setShowDrawModal(true)}
            className="w-full sm:w-auto px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
            title="Nhập mô tả và vẽ ảnh tuỳ chỉnh bằng Imagen để chèn tại vị trí nháy chuột"
          >
            <span>✨ Vẽ ảnh AI</span>
            <Image className="h-3 w-3 text-purple-650" />
          </button>

          {/* Dynamic Placeholder Insertion Dropdown Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTagMenu(!showTagMenu)}
              className="w-full sm:w-auto px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>✨ Chèn thẻ cá nhân hóa</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showTagMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2">
                <div className="px-2.5 py-1 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                  Chọn biến để chèn vào vị trí nháy chuột:
                </div>
                <div className="mt-1 grid grid-cols-1 gap-0.5">
                  {placeholders.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => insertPlaceholder(ph)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-indigo-50 text-xs font-bold text-slate-700 hover:text-indigo-800 rounded-lg transition flex items-center gap-1.5"
                    >
                      <span className="text-indigo-600 font-mono text-[11px]">{"{{"}{ph}{"}}"}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {ph === "name" ? "(Tên khách)" : ph === "company" ? "(Công ty)" : ph === "discount" ? "(Mức KM)" : ph === "email" ? "(Email nhận)" : `(Cột ${ph})`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Formatting Toolbars on Visual Selection Mode */}
      {activeTab === "visual" && (
        <div className="flex flex-wrap items-center bg-white border-b border-slate-100 p-2 gap-1 overflow-x-auto select-none">
          {/* General Actions group */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => handleBlockFormat("<p>")}
              title="Định dạng thường (Paragraph)"
              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition text-xs font-bold flex items-center gap-0.5 px-2"
            >
              <Type className="h-3.5 w-3.5 text-slate-400" />
              <span>P</span>
            </button>
            <button
              type="button"
              onClick={() => handleBlockFormat("<h1>")}
              title="Tiêu đề 1"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition text-xs font-bold px-2"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => handleBlockFormat("<h2>")}
              title="Tiêu đề 2"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition text-xs font-bold px-2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => handleBlockFormat("<h3>")}
              title="Tiêu đề 3"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition text-xs font-bold px-2"
            >
              H3
            </button>
          </div>

          {/* Text Style adjustments */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => execCommand("bold")}
              title="Chữ đậm (Ctrl+B)"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("italic")}
              title="Chữ nghiêng (Ctrl+I)"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("underline")}
              title="Gạch chân (Ctrl+U)"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Underline className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("strikeThrough")}
              title="Gạch ngang"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Strikethrough className="h-4 w-4" />
            </button>
          </div>

          {/* Alignment controls */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => execCommand("justifyLeft")}
              title="Căn lề trái"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("justifyCenter")}
              title="Căn giữa"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("justifyRight")}
              title="Căn lề phải"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>

          {/* List controls */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => execCommand("insertUnorderedList")}
              title="Danh sách dấu chấm"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("insertOrderedList")}
              title="Danh sách số thứ tự"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
          </div>

          {/* Advanced visual tools */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 relative">
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Màu chữ"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition flex items-center gap-0.5"
            >
              <Palette className="h-4 w-4 text-slate-650" />
              <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
            </button>

            {showColorPicker && (
              <div className="absolute top-8 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 flex flex-wrap gap-1 w-[130px]">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      execCommand("foreColor", color);
                      setShowColorPicker(false);
                    }}
                    style={{ backgroundColor: color }}
                    className="w-5 h-5 rounded-full border border-slate-200/50 hover:scale-110 active:scale-95 transition"
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={insertLink}
              title="Chèn liên kết đường dẫn"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Link className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("insertHorizontalRule")}
              title="Chèn đường gạch ngang"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Undo and Redo safety buttons */}
          <div className="flex items-center gap-0.5 pl-1">
            <button
              type="button"
              onClick={() => execCommand("undo")}
              title="Hoàn tác (Ctrl+Z)"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => execCommand("redo")}
              title="Làm lại (Ctrl+Y)"
              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded transition"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Editing Panels depending on selection */}
      <div className="relative flex-1 bg-white min-h-[350px]">
        {activeTab === "visual" ? (
          <div
            id="wysiwyg-visual-composer"
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            className="editor-rich-content min-h-[350px] p-5 overflow-y-auto text-sm text-slate-800 leading-relaxed max-w-full focus:outline-none"
            placeholder="Hãy viết nội dung hoặc thiết kế bức thư của bạn tại đây..."
          />
        ) : (
          <textarea
            id="html-raw-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={16}
            placeholder="<html><body><h1>Chào {{name}}</h1>...</body></html>"
            className="block w-full h-full min-h-[350px] p-4 text-xs font-mono text-slate-700 border-none bg-slate-50 focus:outline-none focus:bg-white resize-y"
          />
        )}
      </div>

      {/* Editor footer feedback */}
      <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 font-semibold">
          <FileText className="h-3.5 w-3.5 text-indigo-500" />
          <span>Biến có sẵn:</span>
          <div className="flex gap-1">
            {placeholders.slice(0, 4).map((ph) => (
              <code key={ph} className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px] font-mono leading-none">{"{{"}{ph}{"}}"}</code>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          <span>Để xuống dòng mới, nhấn <strong>Shift + Enter</strong> hoặc <strong>Enter</strong>.</span>
        </div>
      </div>

      {/* Draw Custom Image AI Modal Dialog Overlay */}
      {showDrawModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Image className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Vẽ ảnh marketing bằng AI Imagen</h3>
                <p className="text-[11px] text-slate-400">Thiết kế hình ảnh độc bản chèn vào email ngay lập tức</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Mô tả chi tiết ảnh vẽ (bằng tiếng Anh sẽ đẹp nhất):</label>
                <textarea
                  required
                  rows={3}
                  value={customImagePrompt}
                  onChange={(e) => setCustomImagePrompt(e.target.value)}
                  placeholder="e.g. A gorgeous coffee mug sits on a serene wooden deck overlooking mountain mist, warm sunlight, clean watercolor style"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Tỷ lệ khung hình:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomImageAspect("16:9")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${customImageAspect === "16:9" ? "border-purple-500 bg-purple-50 text-purple-700 font-extrabold" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                  >
                    16:9 (Ngang rộng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomImageAspect("1:1")}
                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${customImageAspect === "1:1" ? "border-purple-500 bg-purple-50 text-purple-700 font-extrabold" : "border-slate-200 hover:bg-slate-50 text-slate-600"}`}
                  >
                    1:1 (Hình vuông)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDrawModal(false);
                  setCustomImagePrompt("");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 text-xs rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDrawingImage || !customImagePrompt.trim()}
                onClick={handleDrawAndInsertImage}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 text-xs rounded-xl transition disabled:opacity-50"
              >
                {isDrawingImage ? "⏳ Đang vẽ..." : "🎨 Vẽ & Chèn Ngay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

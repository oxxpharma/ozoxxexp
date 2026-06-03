import { useState, useRef } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.REACT_APP_BACKEND_URL;

export function fileUrl(file) {
  if (!file) return "";
  if (typeof file === "string") {
    if (file.startsWith("http") || file.startsWith("data:")) return file;
    if (file.startsWith("/api/")) return `${API_BASE}${file}`;
    return file;
  }
  if (file.url) return `${API_BASE}${file.url}`;
  return "";
}

export default function ImageUpload({ value, onChange, label = "Imagem", testId }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handle = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(`${API_BASE}${data.url}`);
      toast.success("Upload concluído");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-ozx-muted text-xs uppercase tracking-wider">{label}</p>}
      {value ? (
        <div className="relative group glass-card rounded-2xl overflow-hidden">
          <img src={value} alt="" className="w-full h-32 object-cover" />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button size="sm" variant="outline" className="bg-ozx-bg2/80 border-white/20 text-white" onClick={() => inputRef.current?.click()} data-testid={`${testId}-replace`}>
              <Upload className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="bg-ozx-bg2/80 border-ozx-danger/40 text-ozx-danger" onClick={() => onChange("")} data-testid={`${testId}-clear`}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 glass-card rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-ozx-primary/40 transition text-ozx-muted hover:text-white"
          data-testid={testId}
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="text-xs">{uploading ? "Enviando..." : "Clique para enviar"}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handle} className="hidden" />
    </div>
  );
}

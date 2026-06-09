import { useEffect, useState } from "react";
import api from "../lib/api";
import { AlertTriangle, X } from "lucide-react";

const COLOR_CLASSES = {
  yellow: "bg-yellow-500/90 text-black border-yellow-600",
  red: "bg-red-500/90 text-white border-red-600",
  blue: "bg-blue-500/90 text-white border-blue-600",
  green: "bg-emerald-500/90 text-white border-emerald-600",
};

/**
 * Faixa de aviso global — aparece no topo de TODAS as páginas públicas
 * quando appearance.notice_enabled estiver ativo no admin.
 */
export default function SiteNotice() {
  const [notice, setNotice] = useState(null);
  const [closed, setClosed] = useState(false);

  // 1) Busca config
  useEffect(() => {
    let cancelled = false;
    api.get("/public/config").then((r) => {
      if (cancelled) return;
      const a = r.data?.appearance || {};
      if (a.notice_enabled && (a.notice_text || "").trim()) {
        setNotice({
          text: a.notice_text,
          color: COLOR_CLASSES[a.notice_color] || COLOR_CLASSES.yellow,
        });
        try {
          const prevText = sessionStorage.getItem("site_notice_text");
          if (prevText !== a.notice_text) {
            sessionStorage.removeItem("site_notice_closed");
            sessionStorage.setItem("site_notice_text", a.notice_text);
          }
          setClosed(sessionStorage.getItem("site_notice_closed") === "1");
        } catch (_) {}
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 2) Reserva espaço no topo (CSS var lida pelo Navbar)
  const isVisible = !!(notice && !closed);
  useEffect(() => {
    if (isVisible) {
      document.documentElement.style.setProperty("--notice-offset", "44px");
    } else {
      document.documentElement.style.removeProperty("--notice-offset");
    }
    return () => document.documentElement.style.removeProperty("--notice-offset");
  }, [isVisible]);

  if (!isVisible) return null;

  const handleClose = () => {
    setClosed(true);
    try { sessionStorage.setItem("site_notice_closed", "1"); } catch (_) {}
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 border-b ${notice.color} px-4 py-2.5 text-sm font-medium z-[60]`}
      role="alert"
      data-testid="site-notice"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 pr-8">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <p className="flex-1 leading-snug">{notice.text}</p>
        <button
          onClick={handleClose}
          aria-label="Fechar aviso"
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition"
          data-testid="site-notice-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

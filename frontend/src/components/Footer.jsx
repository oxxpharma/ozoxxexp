import { Instagram, Twitter, Youtube, Mail } from "lucide-react";

export default function Footer({ event }) {
  return (
    <footer className="relative border-t border-white/5 bg-ozx-bg2/50 mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-ozx-primary to-ozx-secondary glow-primary" />
              <span className="font-display text-lg font-semibold">Ozoxx<span className="text-ozx-primary">.</span></span>
            </div>
            <p className="text-ozx-muted text-sm max-w-md">{event?.short_pitch || "08 e 09 de Outubro · São Paulo"}</p>
            <p className="text-ozx-muted text-sm mt-1">{event?.location_address}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ozx-primary mb-4">Navegação</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#sobre" className="text-ozx-muted hover:text-white">Sobre</a></li>
              <li><a href="#ingressos" className="text-ozx-muted hover:text-white">Ingressos</a></li>
              <li><a href="#galeria" className="text-ozx-muted hover:text-white">Galeria</a></li>
              <li><a href="#faq" className="text-ozx-muted hover:text-white">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ozx-primary mb-4">Conecte-se</p>
            <div className="flex gap-3">
              <a href="#" className="h-9 w-9 rounded-full glass-card flex items-center justify-center hover:bg-white/10"><Instagram className="w-4 h-4" /></a>
              <a href="#" className="h-9 w-9 rounded-full glass-card flex items-center justify-center hover:bg-white/10"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="h-9 w-9 rounded-full glass-card flex items-center justify-center hover:bg-white/10"><Youtube className="w-4 h-4" /></a>
              <a href="mailto:contato@ozoxx.com" className="h-9 w-9 rounded-full glass-card flex items-center justify-center hover:bg-white/10"><Mail className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ozx-muted">© 2025 Ozoxx Experience. Todos os direitos reservados.</p>
          <p className="text-xs text-ozx-muted">Pagamentos seguros via PagBank · LGPD compliant</p>
        </div>
      </div>
    </footer>
  );
}

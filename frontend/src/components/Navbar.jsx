import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, ScanLine, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar({ logoUrl, logoSize }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const size = Math.min(80, Math.max(24, Number(logoSize) || 32));

  const handleLogout = async () => { await logout(); navigate("/"); };

  const links = [
    { to: "/", label: "Início" },
    { to: "/#sobre", label: "Sobre" },
    { to: "/#palestrantes", label: "Palestrantes" },
    { to: "/#ingressos", label: "Ingressos" },
    { to: "/#galeria", label: "Galeria" },
    { to: "/#faq", label: "FAQ" },
  ];

  return (
    <header className="fixed left-0 right-0 z-50 backdrop-blur-2xl bg-ozx-bg/60 border-b border-white/5" style={{ top: "var(--notice-offset, 0px)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="Ozoxx" style={{ height: `${size}px` }} className="w-auto" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-ozx-primary to-ozx-secondary glow-primary" />
                <div className="absolute inset-0 h-7 w-7 rounded-lg border border-ozx-primary/40" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight">Ozoxx<span className="text-ozx-primary">.</span></span>
            </div>
          )}
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.to} href={l.to} className="text-sm text-ozx-muted hover:text-white transition-colors" data-testid={`nav-link-${l.label}`}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {user ? (
            <>
              {user.role === "lider" && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/leader")} className="text-white hover:text-ozx-primary" data-testid="nav-leader-btn">
                  <Shield className="w-4 h-4 mr-1.5" /> Meu Painel
                </Button>
              )}
              {user.role === "admin" && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="text-white hover:text-ozx-primary" data-testid="nav-admin-btn">
                  <Shield className="w-4 h-4 mr-1.5" /> Admin
                </Button>
              )}
              {(user.role === "admin" || user.role === "credenciadora") && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/scanner")} className="text-white hover:text-ozx-primary" data-testid="nav-scanner-btn">
                  <ScanLine className="w-4 h-4 mr-1.5" /> Scanner
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-white hover:text-ozx-primary" data-testid="nav-dashboard-btn">
                <LayoutDashboard className="w-4 h-4 mr-1.5" /> Painel
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-ozx-muted" data-testid="nav-logout-btn">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-white" data-testid="nav-login-btn">Entrar</Button>
              <Button size="sm" onClick={() => navigate("/checkout")} className="bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full px-5" data-testid="nav-cta-btn">
                Garantir Ingresso
              </Button>
            </>
          )}
        </div>

        <button className="lg:hidden p-2" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden border-t border-white/5 bg-ozx-bg/95 backdrop-blur-2xl"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {links.map((l) => (
                <a key={l.to} href={l.to} onClick={() => setOpen(false)} className="text-sm text-ozx-muted hover:text-white py-2">{l.label}</a>
              ))}
              <div className="h-px bg-white/5 my-2" />
              {user ? (
                <>
                  <Button onClick={() => { navigate("/dashboard"); setOpen(false); }} className="bg-ozx-primary text-ozx-bg" data-testid="nav-mobile-dashboard">Painel</Button>
                  {user.role === "admin" && (
                    <Button variant="outline" onClick={() => { navigate("/admin"); setOpen(false); }} className="border-white/10">Admin</Button>
                  )}
                  {(user.role === "admin" || user.role === "credenciadora") && (
                    <Button variant="outline" onClick={() => { navigate("/scanner"); setOpen(false); }} className="border-white/10">Scanner</Button>
                  )}
                  <Button variant="ghost" onClick={handleLogout}>Sair</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => { navigate("/login"); setOpen(false); }} variant="outline" className="border-white/10">Entrar</Button>
                  <Button onClick={() => { navigate("/checkout"); setOpen(false); }} className="bg-ozx-primary text-ozx-bg">Garantir Ingresso</Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

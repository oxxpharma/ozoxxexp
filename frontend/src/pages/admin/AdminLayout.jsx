import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Palette, Users, Ticket, ShoppingCart, Settings2, CalendarRange, LogOut, ChevronLeft, Tag, Layers, Megaphone, Mail, BarChart3, Award, Mic } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";

const links = [
  { to: "/admin", label: "Visão Geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Pedidos", icon: ShoppingCart },
  { to: "/admin/users", label: "Usuários", icon: Users },
  { to: "/admin/leaders", label: "Líderes", icon: Award },
  { to: "/admin/tickets", label: "Ingressos", icon: Ticket },
  { to: "/admin/lots", label: "Lotes", icon: Layers },
  { to: "/admin/coupons", label: "Cupons", icon: Tag },
  { to: "/admin/speakers", label: "Palestrantes", icon: Mic },
  { to: "/admin/emails", label: "E-mails", icon: Mail },
  { to: "/admin/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/admin/appearance", label: "Aparência", icon: Palette },
  { to: "/admin/event", label: "Evento", icon: CalendarRange },
  { to: "/admin/integrations", label: "Integrações", icon: Settings2 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-ozx-bg flex">
      <aside className="w-60 border-r border-white/10 bg-ozx-bg2/60 backdrop-blur-xl fixed inset-y-0 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 mb-2 text-ozx-muted hover:text-white text-xs">
            <ChevronLeft className="w-3 h-3" /> Site
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-ozx-primary to-ozx-secondary glow-primary" />
            <span className="font-display text-lg font-semibold">Ozoxx Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                  isActive ? "bg-ozx-primary/15 text-ozx-primary border border-ozx-primary/25" : "text-ozx-muted hover:text-white hover:bg-white/5"
                }`
              }
              data-testid={`admin-nav-${l.label}`}
            >
              <l.icon className="w-4 h-4" /> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-ozx-muted truncate">{user?.email}</p>
          <Button onClick={async () => { await logout(); navigate("/"); }} variant="ghost" size="sm" className="w-full mt-2 text-ozx-muted hover:text-white justify-start" data-testid="admin-logout">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 ml-60 p-8 lg:p-10 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

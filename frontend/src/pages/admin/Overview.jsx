import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Users, ShoppingCart, CheckCircle2, Clock, TrendingUp, Ticket, XCircle, Award, Tag, Eye } from "lucide-react";
import { motion } from "framer-motion";

const cards = [
  { key: "total_users", label: "Usuários", icon: Users },
  { key: "total_orders", label: "Pedidos", icon: ShoppingCart },
  { key: "paid_orders", label: "Pagos", icon: CheckCircle2, color: "text-ozx-success" },
  { key: "pending_orders", label: "Aguardando", icon: Clock, color: "text-ozx-warning" },
  { key: "declined_orders", label: "Recusados", icon: XCircle, color: "text-ozx-danger" },
  { key: "checked_in", label: "Check-ins", icon: CheckCircle2, color: "text-ozx-primary" },
  { key: "total_leaders", label: "Líderes", icon: Award, color: "text-ozx-primary" },
  { key: "total_coupons", label: "Cupons", icon: Tag, color: "text-ozx-primary" },
];

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [utm, setUtm] = useState([]);
  const [daily, setDaily] = useState([]);
  const [abandoned, setAbandoned] = useState([]);
  const [methods, setMethods] = useState([]);
  const [profile, setProfile] = useState(null);
  const [sales, setSales] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data));
    api.get("/admin/analytics/funnel").then((r) => setFunnel(r.data));
    api.get("/admin/analytics/utm-sources").then((r) => setUtm(r.data));
    api.get("/admin/analytics/daily-visits?days=14").then((r) => setDaily(r.data));
    api.get("/admin/analytics/abandoned-carts").then((r) => setAbandoned(r.data));
    api.get("/admin/analytics/payment-methods").then((r) => setMethods(r.data));
    api.get("/admin/analytics/customer-profile").then((r) => setProfile(r.data));
    api.get("/admin/analytics/sales-summary").then((r) => setSales(r.data));
  }, []);

  const maxDaily = Math.max(1, ...daily.map((d) => d.visits));

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Dashboard</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-2">Visão geral</h1>
      <p className="text-ozx-muted mb-8">Tudo o que está acontecendo no Ozoxx Experience.</p>

      {/* Revenue + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-ozx-primary" />
            <p className="text-xs uppercase tracking-wider text-ozx-muted">Receita confirmada</p>
          </div>
          <p className="font-display text-5xl font-semibold mb-4" data-testid="dashboard-revenue">R$ {Number(stats?.revenue || 0).toFixed(2).replace(".", ",")}</p>
          {funnel && (
            <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
              <FunnelStep label="Visitas" value={funnel.visits} />
              <FunnelStep label="Checkouts" value={funnel.checkout_views} />
              <FunnelStep label="Pedidos" value={funnel.orders} />
              <FunnelStep label="Pagos" value={funnel.paid} color="text-ozx-success" />
            </div>
          )}
        </div>
        <div className="glass-card rounded-3xl p-6">
          <p className="text-xs uppercase tracking-wider text-ozx-muted mb-3">Métricas rápidas</p>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c, i) => (
              <motion.div
                key={c.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-white/5 rounded-xl p-3"
                data-testid={`stat-${c.key}`}
              >
                <c.icon className={`w-4 h-4 ${c.color || "text-ozx-primary"} mb-1`} />
                <p className="text-[10px] text-ozx-muted uppercase tracking-wider">{c.label}</p>
                <p className="font-display text-xl">{stats?.[c.key] ?? 0}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily visits chart */}
      <div className="glass-card rounded-3xl p-6 lg:p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">Acessos diários (14 dias)</h3>
          <Eye className="w-5 h-5 text-ozx-primary" />
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {daily.length === 0 ? (
            <p className="text-ozx-muted text-sm">Sem dados ainda.</p>
          ) : (
            daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="text-[10px] text-ozx-muted opacity-0 group-hover:opacity-100">{d.visits}</div>
                <div className="w-full rounded-t-md bg-gradient-to-t from-ozx-primary/40 to-ozx-primary glow-primary" style={{ height: `${(d.visits / maxDaily) * 100}%` }} />
                <div className="text-[9px] text-ozx-muted truncate">{d.date.slice(5)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* UTM Sources */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-display text-xl mb-4">Origens (UTM)</h3>
          {utm.length === 0 ? <p className="text-ozx-muted text-sm">Nenhum tráfego rastreado.</p> : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {utm.slice(0, 8).map((u, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                  <div>
                    <p className="text-white">{u.source} {u.medium && <span className="text-ozx-muted text-xs">· {u.medium}</span>}</p>
                    {u.campaign && <p className="text-xs text-ozx-muted">{u.campaign}</p>}
                  </div>
                  <div className="text-right text-xs">
                    <p>{u.visits} visitas</p>
                    <p className="text-ozx-success">{u.paid} pagos</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-display text-xl mb-4">Métodos de pagamento</h3>
          {methods.length === 0 ? <p className="text-ozx-muted text-sm">Sem dados.</p> : (
            <div className="space-y-3">
              {methods.map((m) => (
                <div key={m.method} className="flex items-center justify-between">
                  <p className="capitalize text-sm">{m.method.replace("_", " ")}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-ozx-muted">{m.count} pedidos</span>
                    <span className="text-ozx-success">·</span>
                    <span className="text-ozx-success">{m.paid} pagos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales by lot */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-display text-xl mb-4">Vendas por lote</h3>
          {!sales || sales.by_lot.length === 0 ? <p className="text-ozx-muted text-sm">Sem vendas.</p> : (
            <div className="space-y-3">
              {sales.by_lot.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                  <p>{l.lot_name}</p>
                  <div className="text-right text-xs">
                    <p>{l.tickets} ingressos</p>
                    <p className="text-ozx-success">R$ {Number(l.revenue).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer profile */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-display text-xl mb-4">Perfil dos clientes</h3>
          {!profile ? <p className="text-ozx-muted text-sm">Carregando...</p> : (
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-ozx-muted uppercase mb-2">Sexo</p>
                {profile.by_gender.map((r) => <p key={r._id}>{r._id}: {r.count}</p>)}
                {profile.by_gender.length === 0 && <p className="text-ozx-muted">—</p>}
              </div>
              <div>
                <p className="text-ozx-muted uppercase mb-2">Estados</p>
                {profile.by_state.map((r) => <p key={r._id}>{r._id}: {r.count}</p>)}
                {profile.by_state.length === 0 && <p className="text-ozx-muted">—</p>}
              </div>
              <div>
                <p className="text-ozx-muted uppercase mb-2">Cidades</p>
                {profile.by_city.map((r) => <p key={r._id}>{r._id}: {r.count}</p>)}
                {profile.by_city.length === 0 && <p className="text-ozx-muted">—</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Abandoned carts */}
      <div className="glass-card rounded-3xl p-6 mb-6">
        <h3 className="font-display text-xl mb-4">Carrinhos abandonados (24h+)</h3>
        {abandoned.length === 0 ? <p className="text-ozx-muted text-sm">Nenhum carrinho abandonado.</p> : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {abandoned.slice(0, 20).map((o) => (
              <div key={o.order_id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                <div>
                  <p>{o.holder_name}</p>
                  <p className="text-xs text-ozx-muted">{o.holder_email} · {o.ticket_type_name}</p>
                </div>
                <p className="text-ozx-warning">R$ {Number(o.total_amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, color }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wider text-ozx-muted">{label}</p>
      <p className={`font-display text-3xl ${color || "text-white"}`}>{value || 0}</p>
    </div>
  );
}

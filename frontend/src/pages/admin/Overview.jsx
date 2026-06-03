import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Users, ShoppingCart, CheckCircle2, Clock, TrendingUp, Ticket } from "lucide-react";
import { motion } from "framer-motion";

const cards = [
  { key: "total_users", label: "Usuários", icon: Users, color: "text-ozx-primary" },
  { key: "total_orders", label: "Pedidos", icon: ShoppingCart, color: "text-white" },
  { key: "paid_orders", label: "Pagos", icon: CheckCircle2, color: "text-ozx-success" },
  { key: "pending_orders", label: "Aguardando", icon: Clock, color: "text-ozx-warning" },
  { key: "total_credentials", label: "Credenciais", icon: Ticket, color: "text-ozx-primary" },
  { key: "checked_in", label: "Check-ins", icon: CheckCircle2, color: "text-ozx-success" },
];

export default function Overview() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setStats(r.data)); }, []);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Dashboard</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-10">Visão geral</h1>

      {!stats ? <p className="text-ozx-muted">Carregando...</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            {cards.map((c, i) => (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="glass-card rounded-2xl p-5"
                data-testid={`stat-${c.key}`}
              >
                <c.icon className={`w-5 h-5 ${c.color} mb-3`} />
                <p className="text-xs text-ozx-muted uppercase tracking-wider">{c.label}</p>
                <p className="font-display text-3xl font-medium mt-1">{stats[c.key] ?? 0}</p>
              </motion.div>
            ))}
          </div>

          <div className="glass-card rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-ozx-primary" />
              <p className="text-xs uppercase tracking-wider text-ozx-muted">Receita confirmada</p>
            </div>
            <p className="font-display text-5xl font-semibold">R$ {Number(stats.revenue || 0).toFixed(2).replace(".", ",")}</p>
          </div>
        </>
      )}
    </div>
  );
}
